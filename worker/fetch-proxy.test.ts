// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApi } from './api'
import type { ApiEnv } from './env'
import { FETCH_USER_AGENT } from './fetch-proxy'
import worker from './index'

const ctx = { waitUntil() {}, passThroughOnException() {} } as ExecutionContext
const ORIGIN = 'https://stringutilitybelt.com'

let ipCounter = 0
/** A fresh client IP per request builder, so the shared default limiter never interferes. */
const freshIp = () => `client-${++ipCounter}`

/** What the app's own `fetch('/api/fetch?url=…')` sends (plus a client IP). */
const BROWSER_FETCH = { 'sec-fetch-site': 'same-origin', 'sec-fetch-mode': 'cors', 'sec-fetch-dest': 'empty' }

function proxyRequest(target: string, headers: Record<string, string> = {}, init: RequestInit = {}): Request {
  return new Request(`${ORIGIN}/api/fetch?url=${encodeURIComponent(target)}`, {
    headers: { ...BROWSER_FETCH, 'cf-connecting-ip': freshIp(), ...headers },
    ...init,
  })
}

const call = (req: Request, env: ApiEnv = {}) => worker.fetch(req, env, ctx)

let upstream: ReturnType<typeof vi.fn>
beforeEach(() => {
  upstream = vi.fn()
  vi.spyOn(globalThis, 'fetch').mockImplementation(upstream as unknown as typeof fetch)
})
afterEach(() => { vi.restoreAllMocks() })

const reply = (body: BodyInit | null, init: ResponseInit = {}) => new Response(body, init)
const redirect = (location: string | null, status = 302) =>
  new Response(null, { status, headers: location === null ? {} : { location } })

describe('GET /api/fetch: success', () => {
  it('returns the upstream body and content-type with safe headers', async () => {
    upstream.mockResolvedValueOnce(reply('{"ok":true}', {
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'set-cookie': 'session=abc; HttpOnly',
        'access-control-allow-origin': '*',
        'x-upstream-secret': 'nope',
      },
    }))
    const res = await call(proxyRequest('https://api.example.com/data.json'))
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('{"ok":true}')
    expect(res.headers.get('content-type')).toBe('application/json; charset=utf-8')
    expect(res.headers.get('x-subelt-final-url')).toBe('https://api.example.com/data.json')
    expect(res.headers.get('set-cookie')).toBeNull()
    expect(res.headers.get('access-control-allow-origin')).toBeNull()
    expect(res.headers.get('x-upstream-secret')).toBeNull()
    expect(res.headers.get('content-security-policy')).toMatch(/sandbox/)
    expect(res.headers.get('x-content-type-options')).toBe('nosniff')
    expect(res.headers.get('cache-control')).toBe('no-store')
  })

  it('sends a plain GET with our User-Agent and none of the caller’s credentials', async () => {
    upstream.mockResolvedValueOnce(reply('hi', { headers: { 'content-type': 'text/plain' } }))
    await call(proxyRequest('https://example.com/x', {
      cookie: 'sid=secret', authorization: 'Bearer secret', 'x-forwarded-for': '10.0.0.1', referer: `${ORIGIN}/`,
    }))
    expect(upstream).toHaveBeenCalledTimes(1)
    const [url, init] = upstream.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://example.com/x')
    expect(init.method).toBe('GET')
    expect(init.redirect).toBe('manual')
    expect(init.signal).toBeInstanceOf(AbortSignal)
    const sent = new Headers(init.headers)
    expect(sent.get('user-agent')).toBe(FETCH_USER_AGENT)
    expect([...sent.keys()].sort()).toEqual(['accept', 'user-agent'])
    expect(init.body).toBeUndefined()
  })

  it('passes binary bodies through byte for byte', async () => {
    const bytes = new Uint8Array([0, 255, 128, 7])
    upstream.mockResolvedValueOnce(reply(bytes, { headers: { 'content-type': 'application/octet-stream' } }))
    const res = await call(proxyRequest('https://example.com/blob'))
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(bytes)
    expect(res.headers.get('content-type')).toBe('application/octet-stream')
  })

  // the client treats "no declared type" as "text if it is strict UTF-8", exactly as for a
  // direct fetch; inventing application/octet-stream here would turn such text into bytes
  it('leaves the content-type absent when the upstream sent none', async () => {
    upstream.mockResolvedValueOnce(new Response(new TextEncoder().encode('plain words')))
    const res = await call(proxyRequest('https://example.com/README'))
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBeNull()
    expect(res.headers.get('x-content-type-options')).toBe('nosniff')
    expect(res.headers.get('content-disposition')).toBe('attachment')
    expect(await res.text()).toBe('plain words')
  })
})

describe('GET /api/fetch: redirects', () => {
  it('follows relative redirects, reporting the final URL', async () => {
    upstream
      .mockResolvedValueOnce(redirect('/moved?x=1', 301))
      .mockResolvedValueOnce(redirect('https://cdn.example.net/final', 307))
      .mockResolvedValueOnce(reply('done', { headers: { 'content-type': 'text/plain' } }))
    const res = await call(proxyRequest('https://example.com/start'))
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('done')
    expect(upstream.mock.calls.map(c => c[0])).toEqual([
      'https://example.com/start', 'https://example.com/moved?x=1', 'https://cdn.example.net/final',
    ])
    expect(res.headers.get('x-subelt-final-url')).toBe('https://cdn.example.net/final')
  })

  it.each([
    'http://127.0.0.1/admin',
    'http://169.254.169.254/latest/meta-data/',
    'http://2130706433/',
    'http://0x7f.1/',
    'http://[::ffff:7f00:1]/',
    'http://localhost./',
    '//10.0.0.1/protocol-relative',
    'http://example.com:6379/',
  ])('re-validates every Location: %s is refused', async location => {
    upstream.mockResolvedValueOnce(redirect(location))
    const res = await call(proxyRequest('https://example.com/'))
    expect(res.status).toBe(403)
    expect((await res.json() as any).error).toMatch(/redirect refused — blocked (host|port)/)
    expect(upstream).toHaveBeenCalledTimes(1)
  })

  it('re-validates a Location on a later hop too', async () => {
    upstream
      .mockResolvedValueOnce(redirect('https://cdn.example.net/next'))
      .mockResolvedValueOnce(redirect('http://[::ffff:169.254.169.254]/latest/meta-data/'))
    const res = await call(proxyRequest('https://example.com/'))
    expect(res.status).toBe(403)
    expect(upstream).toHaveBeenCalledTimes(2)
  })

  it('serves a web port other than the default', async () => {
    upstream.mockResolvedValueOnce(reply('ok'))
    const res = await call(proxyRequest('https://example.com:8443/x'))
    expect(res.status).toBe(200)
    expect(upstream.mock.calls[0][0]).toBe('https://example.com:8443/x')
  })

  it('refuses redirects to non-http(s) or credentialed URLs as an upstream failure', async () => {
    for (const location of ['file:///etc/passwd', 'gopher://example.com/', 'http://user:pw@example.com/']) {
      upstream.mockResolvedValueOnce(redirect(location))
      const res = await call(proxyRequest('https://example.com/'))
      expect(res.status, location).toBe(502)
    }
  })

  it('stops after 3 redirects', async () => {
    upstream.mockImplementation(async (url: string) => redirect(`${url}x`))
    const res = await call(proxyRequest('https://example.com/r'))
    expect(res.status).toBe(502)
    expect((await res.json() as any).error).toMatch(/too many redirects/)
    expect(upstream).toHaveBeenCalledTimes(4)
  })

  it('follows exactly 3 redirects', async () => {
    upstream
      .mockResolvedValueOnce(redirect('/1'))
      .mockResolvedValueOnce(redirect('/2'))
      .mockResolvedValueOnce(redirect('/3'))
      .mockResolvedValueOnce(reply('ok'))
    const res = await call(proxyRequest('https://example.com/0'))
    expect(res.status).toBe(200)
  })

  it('treats a redirect without Location as an upstream failure', async () => {
    upstream.mockResolvedValueOnce(redirect(null))
    const res = await call(proxyRequest('https://example.com/'))
    expect(res.status).toBe(502)
  })
})

describe('GET /api/fetch: size cap', () => {
  it('refuses a declared Content-Length over 5 MB before reading', async () => {
    let cancelled = false
    const body = new ReadableStream({ cancel() { cancelled = true } })
    upstream.mockResolvedValueOnce(reply(body, { headers: { 'content-length': String(5 * 1024 * 1024 + 1) } }))
    const res = await call(proxyRequest('https://example.com/big'))
    expect(res.status).toBe(413)
    expect((await res.json() as any).error).toMatch(/larger than 5 MB/)
    expect(cancelled).toBe(true)
  })

  it('aborts a streamed body once it passes 5 MB', async () => {
    const chunk = new Uint8Array(1024 * 1024)
    let sent = 0
    let cancelled = false
    const body = new ReadableStream<Uint8Array>({
      pull(c) { sent++; c.enqueue(chunk) }, // endless
      cancel() { cancelled = true },
    })
    upstream.mockResolvedValueOnce(reply(body))
    const res = await call(proxyRequest('https://example.com/endless'))
    expect(res.status).toBe(413)
    expect(cancelled).toBe(true)
    expect(sent).toBeLessThanOrEqual(8)
  })

  it('accepts exactly 5 MB', async () => {
    upstream.mockResolvedValueOnce(reply(new Uint8Array(5 * 1024 * 1024)))
    const res = await call(proxyRequest('https://example.com/five'))
    expect(res.status).toBe(200)
    expect((await res.arrayBuffer()).byteLength).toBe(5 * 1024 * 1024)
  })
})

describe('GET /api/fetch: failures', () => {
  it('maps upstream HTTP errors to 502 with the upstream status', async () => {
    upstream.mockResolvedValueOnce(reply('<h1>nope</h1>', { status: 404, headers: { 'content-type': 'text/html' } }))
    const res = await call(proxyRequest('https://example.com/missing'))
    expect(res.status).toBe(502)
    expect(res.headers.get('content-type')).toMatch(/application\/json/)
    expect(await res.json()).toMatchObject({ upstreamStatus: 404 })
  })

  it('maps network errors to 502', async () => {
    upstream.mockRejectedValueOnce(new TypeError('fetch failed'))
    const res = await call(proxyRequest('https://unreachable.example.com/'))
    expect(res.status).toBe(502)
    expect((await res.json() as any).error).toMatch(/could not reach/)
  })

  it('times out a hung connection with 504', async () => {
    const api = createApi({ fetchTimeoutMs: 30 })
    upstream.mockImplementation(() => new Promise(() => {}))
    const res = await api.fetch(proxyRequest('https://slow.example.com/'))
    expect(res.status).toBe(504)
  })

  it('times out a stalled body with 504', async () => {
    const api = createApi({ fetchTimeoutMs: 30 })
    let cancelled = false
    const body = new ReadableStream<Uint8Array>({
      start(c) { c.enqueue(new Uint8Array([1, 2, 3])) }, // then nothing, ever
      cancel() { cancelled = true },
    })
    upstream.mockResolvedValueOnce(reply(body))
    const res = await api.fetch(proxyRequest('https://slow.example.com/'))
    expect(res.status).toBe(504)
    expect(cancelled).toBe(true)
  })

  it('passes the abort signal to the upstream fetch', async () => {
    const api = createApi({ fetchTimeoutMs: 30 })
    let signal: AbortSignal | undefined
    upstream.mockImplementation((_u: string, init: RequestInit) => { signal = init.signal ?? undefined; return new Promise(() => {}) })
    await api.fetch(proxyRequest('https://slow.example.com/'))
    expect(signal?.aborted).toBe(true)
  })
})

describe('GET /api/fetch: input validation', () => {
  it.each([
    ['', 400],
    ['not a url', 400],
    ['ftp://example.com/', 400],
    ['http://user:pw@example.com/', 400],
    ['http://localhost:8787/', 403],
    ['http://[::1]/', 403],
    ['http://017700000001/', 403],
    ['http://example.com:22/', 403],
    ['http://example.com:6379/', 403],
    [`${ORIGIN}/api/fetch?url=https://example.com/`, 403],
  ])('%j → %i without contacting upstream', async (target, status) => {
    const res = await call(proxyRequest(target))
    expect(res.status).toBe(status)
    expect(await res.json()).toHaveProperty('error')
    expect(upstream).not.toHaveBeenCalled()
  })

  it('requires the url parameter', async () => {
    const res = await call(new Request(`${ORIGIN}/api/fetch`, { headers: { 'cf-connecting-ip': freshIp() } }))
    expect(res.status).toBe(400)
  })

  it('only accepts GET', async () => {
    for (const method of ['POST', 'PUT', 'DELETE', 'HEAD']) {
      const res = await call(proxyRequest('https://example.com/', {}, { method }))
      expect(res.status, method).toBe(405)
    }
    expect(upstream).not.toHaveBeenCalled()
  })
})

describe('GET /api/fetch: abuse controls', () => {
  it.each([
    [{ 'sec-fetch-site': 'cross-site' }],
    [{ 'sec-fetch-site': 'same-site' }],
    [{ 'sec-fetch-site': 'none' }],
    [{ 'sec-fetch-site': 'same-origin', origin: 'https://evil.example' }],
    [{ 'sec-fetch-site': 'same-origin', origin: 'null' }],
    [{ 'sec-fetch-site': 'same-origin', origin: 'http://stringutilitybelt.com' }],
  ])('refuses requests that are not from this origin: %j', async headers => {
    const res = await call(proxyRequest('https://example.com/', headers))
    expect(res.status).toBe(403)
    expect(res.headers.get('access-control-allow-origin')).toBeNull()
    expect(upstream).not.toHaveBeenCalled()
  })

  // A same-origin <script>/<link>/<img>/<iframe>/service worker pointed at the proxy would
  // otherwise run or render third-party content as this origin's own (a script-src 'self' bypass).
  it.each([
    [{ 'sec-fetch-dest': 'script', 'sec-fetch-mode': 'no-cors' }],
    [{ 'sec-fetch-dest': 'script', 'sec-fetch-mode': 'cors' }],
    [{ 'sec-fetch-dest': 'style', 'sec-fetch-mode': 'no-cors' }],
    [{ 'sec-fetch-dest': 'image', 'sec-fetch-mode': 'no-cors' }],
    [{ 'sec-fetch-dest': 'iframe', 'sec-fetch-mode': 'navigate' }],
    [{ 'sec-fetch-dest': 'document', 'sec-fetch-mode': 'navigate' }],
    [{ 'sec-fetch-dest': 'serviceworker', 'sec-fetch-mode': 'same-origin' }],
    [{ 'sec-fetch-dest': 'worker', 'sec-fetch-mode': 'same-origin' }],
    [{ 'sec-fetch-dest': 'empty', 'sec-fetch-mode': 'no-cors' }],
    [{ 'sec-fetch-dest': 'empty', 'sec-fetch-mode': 'navigate' }],
  ])('refuses same-origin requests that are not fetch()/XHR: %j', async headers => {
    upstream.mockImplementation(async () => reply('alert(1)', { headers: { 'content-type': 'text/javascript' } }))
    const res = await call(proxyRequest('https://evil.example/x.js', headers))
    expect(res.status).toBe(403)
    expect(res.headers.get('content-type')).toMatch(/application\/json/)
    expect((await res.json() as any).error).toMatch(/only answers fetch/)
    expect(upstream).not.toHaveBeenCalled()
  })

  it('serves fetch() and XHR from this origin in either request mode', async () => {
    upstream.mockImplementation(async () => reply('ok'))
    for (const mode of ['cors', 'same-origin']) {
      const res = await call(proxyRequest('https://example.com/', { 'sec-fetch-mode': mode }))
      expect(res.status, mode).toBe(200)
    }
  })

  it('serves same-origin browser requests and header-less clients', async () => {
    upstream.mockImplementation(async () => reply('ok'))
    const sameOrigin = await call(proxyRequest('https://example.com/', { origin: ORIGIN }))
    expect(sameOrigin.status).toBe(200)
    const bare = await call(new Request(`${ORIGIN}/api/fetch?url=https://example.com/`, { headers: { 'cf-connecting-ip': freshIp() } }))
    expect(bare.status).toBe(200)
  })

  it('answers 503 when FETCH_PROXY is off', async () => {
    for (const value of ['off', 'OFF', ' off ']) {
      const res = await call(proxyRequest('https://example.com/'), { FETCH_PROXY: value })
      expect(res.status).toBe(503)
      expect((await res.json() as any).error).toMatch(/disabled/)
    }
    expect(upstream).not.toHaveBeenCalled()
    upstream.mockResolvedValueOnce(reply('ok'))
    const on = await call(proxyRequest('https://example.com/'), { FETCH_PROXY: 'on' })
    expect(on.status).toBe(200)
  })

  it('rate-limits each client IP to 30 fetches a minute (default worker)', async () => {
    upstream.mockImplementation(async () => reply('ok'))
    const ip = '198.51.100.77'
    const hit = () => call(proxyRequest('https://example.com/', { 'cf-connecting-ip': ip }))
    for (let i = 0; i < 30; i++) expect((await hit()).status).toBe(200)
    const limited = await hit()
    expect(limited.status).toBe(429)
    expect(Number(limited.headers.get('retry-after'))).toBeGreaterThan(0)
    expect(Number(limited.headers.get('retry-after'))).toBeLessThanOrEqual(60)
    expect((await limited.json() as any).error).toMatch(/too many/)
    expect(upstream).toHaveBeenCalledTimes(30)
    // another client is unaffected
    expect((await call(proxyRequest('https://example.com/', { 'cf-connecting-ip': '198.51.100.78' }))).status).toBe(200)
  })

  it('frees slots as the window slides (injected clock)', async () => {
    upstream.mockImplementation(async () => reply('ok'))
    let now = 1_000_000
    const api = createApi({ now: () => now, rateLimit: { limit: 2, windowMs: 60_000 } })
    const hit = () => api.fetch(proxyRequest('https://example.com/', { 'cf-connecting-ip': '192.0.2.1' }))
    expect((await hit()).status).toBe(200)
    now += 30_000
    expect((await hit()).status).toBe(200)
    const limited = await hit()
    expect(limited.status).toBe(429)
    expect(limited.headers.get('retry-after')).toBe('30')
    now += 30_001
    expect((await hit()).status).toBe(200)
  })

  it('refuses requests from Workers and from the proxy itself (no chaining or loops)', async () => {
    const cases: Array<Record<string, string>> = [
      { 'cf-worker': 'someone.example' }, { 'user-agent': FETCH_USER_AGENT }, { 'user-agent': 'StringUtilityBelt-Fetch/2.0' },
    ]
    for (const headers of cases) {
      const res = await call(proxyRequest('https://example.com/', headers))
      expect(res.status, JSON.stringify(headers)).toBe(403)
      expect((await res.json() as any).error).toMatch(/does not serve other proxies or Workers/)
    }
    expect(upstream).not.toHaveBeenCalled()
  })

  it('rate-limits IPv6 clients per /64, so rotating addresses does not help', async () => {
    upstream.mockImplementation(async () => reply('ok'))
    const api = createApi({ rateLimit: { limit: 2, windowMs: 60_000 } })
    const from = (ip: string) => api.fetch(proxyRequest('https://example.com/', { 'cf-connecting-ip': ip }))
    expect((await from('2001:db8:aa:1::1')).status).toBe(200)
    expect((await from('2001:db8:aa:1::2')).status).toBe(200)
    expect((await from('2001:db8:aa:1:ffff::9')).status).toBe(429)
    expect((await from('2001:db8:aa:2::1')).status).toBe(200) // another /64
  })

  it('counts refused targets against the limit too (no free SSRF probing)', async () => {
    const api = createApi({ rateLimit: { limit: 2, windowMs: 60_000 } })
    const probe = (host: string) => api.fetch(proxyRequest(`http://${host}/`, { 'cf-connecting-ip': '192.0.2.9' }))
    expect((await probe('10.0.0.1')).status).toBe(403)
    expect((await probe('10.0.0.2')).status).toBe(403)
    expect((await probe('10.0.0.3')).status).toBe(429)
  })
})
