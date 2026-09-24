import type { Value } from '@/types/utility'
import { tryDecodeUtf8Strict } from './bytes'

/** Same cap the Worker proxy enforces; a direct fetch must not be able to exhaust tab memory either. */
export const MAX_FETCH_BYTES = 5 * 1024 * 1024

export interface FetchInputResult {
  value: Value
  contentType: string | null
  /** Where the body actually came from, after redirects. */
  finalUrl: string
}

export interface FetchInputOptions {
  signal?: AbortSignal
}

const TOO_LARGE = 'the response is larger than 5 MB'

const WORKER_ERROR_MESSAGES: Record<number, string> = {
  400: 'that is not a valid URL',
  403: 'that host is blocked',
  413: TOO_LARGE,
  429: 'too many fetches — try again in a moment',
  502: 'the upstream server failed to respond',
  503: 'the fetch proxy is disabled',
  504: 'the request timed out',
}

/**
 * Text vs bytes from the MIME essence: text/*, json, xml, javascript and the +json/+xml
 * suffixes. Matches whole subtypes, so e.g. `vnd.openxmlformats-…` (a zip) stays bytes.
 */
export function isTextContentType(contentType: string | null): boolean {
  if (!contentType) return false
  const essence = contentType.split(';')[0].trim().toLowerCase()
  const slash = essence.indexOf('/')
  if (slash <= 0) return false
  const type = essence.slice(0, slash)
  const sub = essence.slice(slash + 1)
  if (type === 'text') return true
  return ['json', 'xml', 'javascript', 'x-javascript', 'ecmascript'].includes(sub) ||
    sub.endsWith('+json') || sub.endsWith('+xml')
}

function charsetOf(contentType: string | null): string | null {
  const m = /;\s*charset\s*=\s*"?([^";\s]+)/i.exec(contentType ?? '')
  return m ? m[1] : null
}

/** Decodes with the declared charset (UTF-8 by default), keeping any BOM like opened files do. */
function decodeText(bytes: Uint8Array, contentType: string | null): string {
  try {
    return new TextDecoder(charsetOf(contentType) ?? 'utf-8', { ignoreBOM: true }).decode(bytes)
  } catch {
    return new TextDecoder('utf-8', { ignoreBOM: true }).decode(bytes) // unknown charset label
  }
}

/** Reads the body, refusing (and cancelling) anything over MAX_FETCH_BYTES, declared or streamed. */
async function readCapped(res: Response): Promise<Uint8Array> {
  const declared = Number(res.headers.get('content-length') ?? '')
  if (Number.isFinite(declared) && declared > MAX_FETCH_BYTES) {
    res.body?.cancel().catch(() => { /* nothing to release */ })
    throw new Error(TOO_LARGE)
  }
  if (!res.body) {
    const buf = new Uint8Array(await res.arrayBuffer())
    if (buf.length > MAX_FETCH_BYTES) throw new Error(TOO_LARGE)
    return buf
  }
  const reader = res.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.length
    if (total > MAX_FETCH_BYTES) {
      reader.cancel().catch(() => { /* already failing */ })
      throw new Error(TOO_LARGE)
    }
    chunks.push(value)
  }
  const out = new Uint8Array(total)
  let at = 0
  for (const c of chunks) { out.set(c, at); at += c.length }
  return out
}

async function toResult(res: Response, finalUrl: string): Promise<FetchInputResult> {
  const contentType = res.headers.get('content-type')
  const bytes = await readCapped(res)
  if (isTextContentType(contentType)) return { value: decodeText(bytes, contentType), contentType, finalUrl }
  if (!contentType) {
    // no declared type: the same rule as opened files — strict UTF-8 is text
    const text = tryDecodeUtf8Strict(bytes)
    if (text !== null) return { value: text, contentType, finalUrl }
  }
  return { value: bytes, contentType, finalUrl }
}

async function fetchDirect(url: string, signal?: AbortSignal): Promise<FetchInputResult> {
  // never attach this site's cookies to a request for an arbitrary user-supplied URL
  const res = await fetch(url, { signal, credentials: 'omit' })
  if (!res.ok) throw new Error(`the server responded with HTTP ${res.status}`)
  return toResult(res, res.url || url)
}

async function fetchViaWorker(url: string, signal?: AbortSignal): Promise<FetchInputResult> {
  const res = await fetch(`/api/fetch?url=${encodeURIComponent(url)}`, { signal })
  if (!res.ok) {
    let message = WORKER_ERROR_MESSAGES[res.status] || `fetch failed (${res.status})`
    try {
      const body = await res.clone().json()
      if (typeof body?.error === 'string' && body.error) message = body.error
    } catch {
      // non-JSON error body: keep the status-based message
    }
    throw new Error(message)
  }
  // The Worker stamps every proxied body. Without the stamp this is some other responder —
  // typically the SPA fallback serving index.html (vite dev, or a deploy without the Worker).
  const finalUrl = res.headers.get('x-subelt-final-url')
  if (!finalUrl) {
    res.body?.cancel().catch(() => { /* discard */ })
    throw new Error('that site does not allow cross-origin requests, and the fetch proxy is not available here')
  }
  return toResult(res, finalUrl)
}

/**
 * Fetches a URL as pipeline input, client-side first (works for CORS-friendly APIs), and
 * falls back to the Worker's `/api/fetch` proxy on a network/CORS failure.
 */
export async function fetchAsInput(url: string, opts: FetchInputOptions = {}): Promise<FetchInputResult> {
  let parsed: URL
  try {
    parsed = new URL(url.trim())
  } catch {
    throw new Error('that is not a valid URL')
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw new Error('only http/https URLs are supported')
  if (parsed.username || parsed.password) throw new Error('URLs with embedded credentials are not supported')
  const href = parsed.href

  try {
    return await fetchDirect(href, opts.signal)
  } catch (err) {
    if (opts.signal?.aborted) throw err
    // a thrown fetch (network error / opaque CORS block) — retry through the proxy;
    // an HTTP error status or an oversize body is a real answer, so it propagates
    if (err instanceof TypeError) return fetchViaWorker(href, opts.signal)
    throw err
  }
}
