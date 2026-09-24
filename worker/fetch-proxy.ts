/**
 * GET /api/fetch?url= — the web app's "Fetch URL" fallback for sites without CORS.
 *
 * Responds with the upstream body and content-type, or JSON `{ error }`:
 * 400 invalid url · 403 blocked host or port / cross-site or non-fetch() caller · 413 over 5 MB ·
 * 429 rate limited · 502 upstream failure · 503 proxy disabled (FETCH_PROXY=off) · 504 timeout.
 *
 * It is not an open proxy: only this site's own pages may call it (no CORS headers
 * are ever sent, and cross-site browser requests are refused), every hop's host and
 * port are vetted by `checkTarget` (see ./ssrf.ts), and nothing from the caller —
 * cookies, authorization, other headers — is forwarded upstream. Headers are advisory
 * for non-browser clients, so the per-isolate rate limit (per IP, per /64 for IPv6) is
 * the only brake on scripted abuse, and it is best-effort: real rate limiting needs a
 * Cloudflare WAF rate-limiting rule on this path.
 */
import type { ApiEnv, UpstreamFetch } from './env'
import { TooLargeError, contentLength, jsonError, readCapped, untilAborted } from './http'
import { rateLimitKey, type RateLimiter } from './rate-limit'
import { checkTarget } from './ssrf'

const UA_PRODUCT = 'StringUtilityBelt-Fetch/'
export const FETCH_USER_AGENT = `${UA_PRODUCT}1.0 (+https://stringutilitybelt.com)`

export interface FetchProxyDeps {
  limiter: RateLimiter
  timeoutMs: number
  maxBytes: number
  maxRedirects: number
  upstreamFetch?: UpstreamFetch
}

const REDIRECTS = new Set([301, 302, 303, 307, 308])

/**
 * Upstream content is served from our origin, so it must never render or run as a
 * page of ours: sandbox it, forbid sniffing and cross-origin embedding.
 */
const SAFE_BODY_HEADERS = {
  'cache-control': 'no-store',
  'content-security-policy': "default-src 'none'; sandbox",
  'content-disposition': 'attachment',
  'cross-origin-resource-policy': 'same-origin',
  'referrer-policy': 'no-referrer',
  'x-content-type-options': 'nosniff',
}

/** Request modes a script's `fetch()`/XHR uses; tags, navigations and beacons use others. */
const FETCH_MODES = new Set(['cors', 'same-origin'])

/**
 * Browsers label every request; anything they say is not from our own origin is refused.
 * So is anything that is not a script's `fetch()`/XHR (destination `empty`): a same-origin
 * `<script src>`, stylesheet, frame or service worker pointed at the proxy would run or
 * render third-party content as this origin's own, bypassing a `script-src 'self'` policy.
 * Requests from Workers (Cloudflare stamps their subrequests with `CF-Worker`) and from
 * this proxy itself (our User-Agent) are refused too, so proxies cannot be chained or
 * looped through another hostname of this deployment.
 */
function refusalReason(request: Request): string | null {
  const site = request.headers.get('sec-fetch-site')
  if (site !== null && site !== 'same-origin') return 'the fetch proxy only serves pages on this site'
  const origin = request.headers.get('origin')
  if (origin !== null && origin !== new URL(request.url).origin) return 'the fetch proxy only serves pages on this site'
  const dest = request.headers.get('sec-fetch-dest')
  const mode = request.headers.get('sec-fetch-mode')
  if ((dest !== null && dest !== 'empty') || (mode !== null && !FETCH_MODES.has(mode))) {
    return 'the fetch proxy only answers fetch() requests'
  }
  if (request.headers.has('cf-worker') || (request.headers.get('user-agent') ?? '').startsWith(UA_PRODUCT)) {
    return 'the fetch proxy does not serve other proxies or Workers'
  }
  return null
}

const cancel = (res: Response) => { res.body?.cancel().catch(() => { /* nothing to release */ }) }

export async function handleFetchProxy(request: Request, env: ApiEnv, deps: FetchProxyDeps): Promise<Response> {
  if ((env.FETCH_PROXY ?? '').trim().toLowerCase() === 'off') {
    return jsonError(503, 'the fetch proxy is disabled')
  }
  if (request.method !== 'GET') {
    return jsonError(405, 'the fetch proxy only accepts GET', {}, { allow: 'GET' })
  }
  const refused = refusalReason(request)
  if (refused) return jsonError(403, refused)

  const wait = deps.limiter.hit(rateLimitKey(request.headers.get('cf-connecting-ip')))
  if (wait) {
    return jsonError(429, `too many fetches; try again in ${wait} s`, {}, { 'retry-after': String(wait) })
  }

  const self = new URL(request.url)
  const first = checkTarget(self.searchParams.get('url') ?? '', { selfHost: self.hostname })
  if (!first.ok) return jsonError(first.status, first.error)

  const doFetch: UpstreamFetch = deps.upstreamFetch ?? ((url, init) => fetch(url, init))
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(new Error('timeout')), deps.timeoutMs)
  const aborted = untilAborted(ctrl.signal)
  const timeout = () => jsonError(504, `the upstream server did not respond within ${deps.timeoutMs / 1000} s`)
  const tooLarge = () => jsonError(413, `the response is larger than ${Math.round(deps.maxBytes / 1024 / 1024)} MB`)

  try {
    let current = first.url
    for (let hop = 0; ; hop++) {
      let res: Response
      try {
        // redirects are followed by hand so every Location is vetted like the original URL;
        // a fresh header set means the caller's cookies and credentials never leave
        res = await Promise.race([doFetch(current.href, {
          method: 'GET',
          redirect: 'manual',
          headers: { 'user-agent': FETCH_USER_AGENT, accept: '*/*' },
          signal: ctrl.signal,
        }), aborted])
      } catch {
        return ctrl.signal.aborted ? timeout() : jsonError(502, 'could not reach the upstream server')
      }

      if (REDIRECTS.has(res.status)) {
        cancel(res)
        const location = res.headers.get('location')
        if (!location) return jsonError(502, `the upstream server sent a ${res.status} redirect without a Location`)
        if (hop >= deps.maxRedirects) return jsonError(502, `too many redirects (the limit is ${deps.maxRedirects})`)
        let next: URL
        try { next = new URL(location, current) } catch { return jsonError(502, 'the upstream server sent an invalid redirect') }
        const check = checkTarget(next, { selfHost: self.hostname })
        if (!check.ok) {
          return check.status === 403
            ? jsonError(403, `redirect refused — ${check.error}`)
            : jsonError(502, `the upstream server redirected to a URL that cannot be fetched (${check.error})`)
        }
        current = check.url
        continue
      }

      if (!res.ok) {
        cancel(res)
        return jsonError(502, `the upstream server responded with HTTP ${res.status}`, { upstreamStatus: res.status })
      }
      const declared = contentLength(res.headers)
      if (declared !== null && declared > deps.maxBytes) { cancel(res); return tooLarge() }

      let body: Uint8Array<ArrayBuffer>
      try {
        body = await readCapped(res.body, deps.maxBytes, ctrl.signal)
      } catch (e) {
        if (e instanceof TooLargeError) return tooLarge()
        return ctrl.signal.aborted ? timeout() : jsonError(502, 'the upstream response was interrupted')
      }
      // an absent type stays absent: the client then applies its own "strict UTF-8 is text"
      // rule, as it does for a direct fetch (nosniff + sandbox keep browsers from guessing)
      const type = res.headers.get('content-type')
      return new Response(body, {
        status: 200,
        headers: {
          ...SAFE_BODY_HEADERS,
          ...(type ? { 'content-type': type } : {}),
          'x-subelt-final-url': current.href,
        },
      })
    }
  } finally {
    clearTimeout(timer)
  }
}
