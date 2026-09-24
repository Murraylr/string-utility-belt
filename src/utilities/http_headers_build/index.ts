import type { Utility } from '@/types/utility'

/**
 * Inverse of http_headers_parse: JSON -> a raw HTTP header block.
 *
 * Accepted input shapes:
 *   { startLine?, method?, path?, httpVersion?, status?, statusText?, headers: {...} }
 *   { "Content-Type": "application/json", ... }        (bare header map)
 *   [ { name, value }, ... ] | [ ["name", "value"], ... ]
 * Header values may be strings, numbers, booleans, or arrays (repeated header).
 */

const META_KEYS = new Set(['startLine', 'method', 'path', 'httpVersion', 'status', 'statusText', 'headers'])

/**
 * Header names whose canonical form is not simply Title-Cased-Per-Dash.
 * Null-prototyped: `constructor` and `__proto__` are legal HTTP token names, and a
 * plain object literal would answer those lookups with inherited members.
 */
const SPECIAL_CASE: Record<string, string> = Object.assign(Object.create(null), {
  'etag': 'ETag',
  'te': 'TE',
  'dnt': 'DNT',
  'dpr': 'DPR',
  'www-authenticate': 'WWW-Authenticate',
  'content-md5': 'Content-MD5',
  'content-dpr': 'Content-DPR',
  'x-xss-protection': 'X-XSS-Protection',
  'x-ua-compatible': 'X-UA-Compatible',
  'x-att-deviceid': 'X-ATT-DeviceId',
  'x-dns-prefetch-control': 'X-DNS-Prefetch-Control',
  'sec-websocket-key': 'Sec-WebSocket-Key',
  'sec-websocket-accept': 'Sec-WebSocket-Accept',
  'sec-websocket-version': 'Sec-WebSocket-Version',
  'sec-websocket-protocol': 'Sec-WebSocket-Protocol',
  'sec-websocket-extensions': 'Sec-WebSocket-Extensions',
  'sec-ch-ua': 'Sec-CH-UA',
  'sec-ch-ua-mobile': 'Sec-CH-UA-Mobile',
  'sec-ch-ua-platform': 'Sec-CH-UA-Platform'
})

const REASONS: Record<number, string> = {
  100: 'Continue', 101: 'Switching Protocols', 103: 'Early Hints',
  200: 'OK', 201: 'Created', 202: 'Accepted', 203: 'Non-Authoritative Information',
  204: 'No Content', 205: 'Reset Content', 206: 'Partial Content',
  300: 'Multiple Choices', 301: 'Moved Permanently', 302: 'Found', 303: 'See Other',
  304: 'Not Modified', 307: 'Temporary Redirect', 308: 'Permanent Redirect',
  400: 'Bad Request', 401: 'Unauthorized', 402: 'Payment Required', 403: 'Forbidden',
  404: 'Not Found', 405: 'Method Not Allowed', 406: 'Not Acceptable',
  407: 'Proxy Authentication Required', 408: 'Request Timeout', 409: 'Conflict',
  410: 'Gone', 411: 'Length Required', 412: 'Precondition Failed',
  413: 'Content Too Large', 414: 'URI Too Long', 415: 'Unsupported Media Type',
  416: 'Range Not Satisfiable', 417: 'Expectation Failed', 418: "I'm a teapot",
  422: 'Unprocessable Content', 425: 'Too Early', 426: 'Upgrade Required',
  428: 'Precondition Required', 429: 'Too Many Requests', 431: 'Request Header Fields Too Large',
  451: 'Unavailable For Legal Reasons',
  500: 'Internal Server Error', 501: 'Not Implemented', 502: 'Bad Gateway',
  503: 'Service Unavailable', 504: 'Gateway Timeout', 505: 'HTTP Version Not Supported',
  511: 'Network Authentication Required'
}

/** RFC 7230 token, plus a leading ':' for HTTP/2 pseudo-headers (:method, :path, …). */
const HEADER_NAME_RE = /^:?[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/

function canonicalize(name: string): string {
  const lower = name.toLowerCase()
  // pseudo-headers are lowercase by definition — never title-case them
  if (lower.startsWith(':')) return lower
  if (SPECIAL_CASE[lower]) return SPECIAL_CASE[lower]
  return lower
    .split('-')
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
    .join('-')
}

function toObject(input: unknown): Record<string, unknown> | unknown[] | null {
  if (input === null || input === undefined) return null
  if (typeof input === 'string') {
    const trimmed = input.trim()
    if (!trimmed) return null
    try {
      const parsed = JSON.parse(trimmed)
      if (parsed && typeof parsed === 'object') return parsed as Record<string, unknown>
    } catch {
      throw new Error('expected JSON: an object of headers, or {startLine, headers}')
    }
    throw new Error('expected JSON: an object of headers, or {startLine, headers}')
  }
  if (typeof input === 'object') return input as Record<string, unknown>
  throw new Error('expected JSON: an object of headers, or {startLine, headers}')
}

/** Flatten any supported header container into ordered [name, value] pairs. */
function toPairs(source: unknown): Array<[string, string]> {
  const pairs: Array<[string, string]> = []

  const pushValue = (name: string, value: unknown) => {
    if (value === null || value === undefined) return
    if (Array.isArray(value)) {
      for (const v of value) pushValue(name, v)
      return
    }
    if (typeof value === 'object') {
      throw new Error(`header "${name}" has a non-scalar value`)
    }
    pairs.push([name, String(value)])
  }

  if (Array.isArray(source)) {
    for (const entry of source) {
      if (Array.isArray(entry)) pushValue(String(entry[0] ?? ''), entry[1])
      else if (entry && typeof entry === 'object') {
        const rec = entry as Record<string, unknown>
        pushValue(String(rec.name ?? rec.key ?? ''), rec.value ?? rec.val ?? '')
      } else if (typeof entry === 'string') {
        const colon = entry.indexOf(':')
        if (colon < 0) throw new Error(`malformed header entry: ${entry}`)
        pushValue(entry.slice(0, colon).trim(), entry.slice(colon + 1).trim())
      }
    }
    return pairs
  }

  for (const [name, value] of Object.entries(source as Record<string, unknown>)) {
    pushValue(name, value)
  }
  return pairs
}

const util: Utility = {
  id: 'http_headers_build',
  name: 'json to http headers',
  category: 'Web & Dev',
  description:
    'Turn JSON headers (optionally with a start line, method/path or status) back into a raw HTTP header block, with canonical header casing and CRLF or LF endings.',
  accepts: 'json',
  produces: 'string',
  tags: ['http', 'headers', 'raw headers', 'request', 'response', 'json to headers'],
  examples: [
    {
      title: 'request headers with a start line',
      input: JSON.stringify({
        method: 'GET',
        path: '/users',
        headers: { 'content-type': 'application/json', 'x-request-id': 'abc123' }
      }),
      params: { canonicalCase: true, eol: 'lf' },
      output: 'GET /users HTTP/1.1\nContent-Type: application/json\nX-Request-Id: abc123'
    }
  ],
  params: {
    canonicalCase: { kind: 'boolean', label: 'canonical header casing', default: true },
    eol: { kind: 'select', label: 'line endings', options: ['crlf', 'lf'], default: 'crlf' }
  },
  apply: (input: any, params: any) => {
    const canonicalCase = params?.canonicalCase !== false
    const eol = params?.eol === 'lf' ? '\n' : '\r\n'

    const source = toObject(input)
    if (!source) return ''

    let headerSource: unknown = source
    let meta: Record<string, unknown> = {}

    if (!Array.isArray(source)) {
      const rec = source as Record<string, unknown>
      const hasMeta = Object.keys(rec).some((k) => META_KEYS.has(k))
      if (hasMeta) {
        meta = rec
        const inner = rec.headers
        headerSource = inner && typeof inner === 'object' ? inner : {}
      }
    }

    const lines: string[] = []

    // ---- start line ------------------------------------------------------
    // method/status win over startLine: after editing the JSON the structured
    // fields are what the user changed, and a stale verbatim start line would
    // silently discard that edit. startLine is the fallback (and the source of
    // the protocol version when no httpVersion field is present).
    const startLine = typeof meta.startLine === 'string' ? meta.startLine.trim() : ''
    const versionField =
      meta.httpVersion === undefined || meta.httpVersion === null ? '' : String(meta.httpVersion).trim()
    const version = versionField || (startLine ? (/(HTTP\/[0-9]+(?:\.[0-9]+)?)/i.exec(startLine)?.[1] ?? '') : 'HTTP/1.1')

    if (meta.method !== undefined && meta.method !== null && String(meta.method).trim()) {
      const method = String(meta.method).trim().toUpperCase()
      const path = meta.path === undefined || meta.path === null || String(meta.path) === '' ? '/' : String(meta.path)
      lines.push(`${method} ${path}${version ? ` ${version}` : ''}`)
    } else if (meta.status !== undefined && meta.status !== null && String(meta.status) !== '') {
      const status = Number(meta.status)
      if (!Number.isFinite(status)) throw new Error(`invalid status: ${String(meta.status)}`)
      const text =
        meta.statusText === undefined || meta.statusText === null || String(meta.statusText) === ''
          ? (REASONS[status] ?? '')
          : String(meta.statusText)
      lines.push(`${version || 'HTTP/1.1'} ${status}${text ? ` ${text}` : ''}`)
    } else if (startLine) {
      lines.push(startLine)
    }

    // ---- headers ---------------------------------------------------------
    for (const [rawName, rawValue] of toPairs(headerSource)) {
      const name = rawName.trim()
      if (!name) throw new Error('empty header name')
      if (!HEADER_NAME_RE.test(name)) throw new Error(`invalid header name: "${name}"`)
      if (/[\r\n]/.test(rawValue)) throw new Error(`header "${name}" value must not contain line breaks`)
      lines.push(`${canonicalCase ? canonicalize(name) : name}: ${rawValue.trim()}`)
    }

    return lines.join(eol)
  }
}

export default util
