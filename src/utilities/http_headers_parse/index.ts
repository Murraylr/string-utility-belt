import type { Utility } from '@/types/utility'

/**
 * Parse a raw HTTP header block (optionally preceded by a request or status
 * start line) into structured JSON.
 *
 * Repeated header names fold into an array, obs-fold continuation lines are
 * unfolded, and header names are compared case-insensitively (HTTP semantics)
 * even when the original casing is preserved.
 */

type HeaderValue = string | string[]

/** RFC 7230 token, plus a leading ':' for HTTP/2 pseudo-headers (:method, :path, …). */
const HEADER_NAME_RE = /^:?[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/
const RESPONSE_LINE_RE = /^(HTTP\/[0-9]+(?:\.[0-9]+)?)[ \t]+([0-9]{3})(?:[ \t]+(.*))?$/i
const REQUEST_LINE_RE = /^([A-Za-z][A-Za-z-]*)[ \t]+(\S+)(?:[ \t]+(HTTP\/[0-9]+(?:\.[0-9]+)?))?$/

const KNOWN_METHODS = new Set([
  'GET', 'HEAD', 'POST', 'PUT', 'DELETE', 'CONNECT', 'OPTIONS', 'TRACE', 'PATCH',
  'PROPFIND', 'PROPPATCH', 'MKCOL', 'COPY', 'MOVE', 'LOCK', 'UNLOCK', 'REPORT',
  'SEARCH', 'PURGE', 'LINK', 'UNLINK'
])

/** Split on any of the three line terminators without losing empty lines. */
const splitLines = (s: string) => s.split(/\r\n|\n|\r/)

/** Trailing SP/HTAB. The lookbehind lets a match start only where a run starts, keeping it linear. */
const TRAILING_BLANKS = /(?<![ \t])[ \t]+$/

const isBlank = (s: string) => /^[ \t]*$/.test(s)

/** RFC 7230 obs-fold: a line starting with SP/HTAB continues the previous one. */
function unfold(lines: string[]): string[] {
  const out: string[] = []
  for (const line of lines) {
    if (/^[ \t]/.test(line) && out.length > 0) {
      out[out.length - 1] = out[out.length - 1].replace(TRAILING_BLANKS, '') + ' ' + line.trim()
    } else {
      out.push(line)
    }
  }
  return out
}

function normalizeIndent(value: unknown): number {
  if (value === undefined || value === null || value === '') return 2
  const n = Number(value)
  if (!Number.isFinite(n)) return 2
  return Math.max(0, Math.min(10, Math.trunc(n)))
}

const util: Utility = {
  id: 'http_headers_parse',
  name: 'http headers to json',
  category: 'Web & Dev',
  description:
    'Parse a raw HTTP header block or a full request/response into JSON, folding repeated headers into arrays, with optional lowercased header names.',
  accepts: 'string',
  // The default indent (2) returns a real JSON value the pipeline pretty-prints
  // itself; any other indent returns pre-formatted JSON text (still re-parsed by
  // the pipeline for a downstream step that accepts json).
  produces: ['json', 'string'],
  tags: ['http', 'headers', 'raw headers', 'parse headers', 'request', 'response', 'json'],
  examples: [
    {
      title: 'a request with a start line',
      input: 'GET /users HTTP/1.1\r\nHost: api.example.com\r\nAccept: application/json\r\n',
      params: { lowercaseNames: true, indent: 2 },
      output:
        '{\n  "startLine": "GET /users HTTP/1.1",\n  "method": "GET",\n  "path": "/users",\n  "httpVersion": "HTTP/1.1",\n  "headers": {\n    "host": "api.example.com",\n    "accept": "application/json"\n  }\n}'
    }
  ],
  params: {
    lowercaseNames: { kind: 'boolean', label: 'lowercase header names', default: true },
    indent: { kind: 'number', label: 'json indent (2 = structured value)', default: 2, min: 0, max: 10, integer: true }
  },
  apply: (input: any, params: any) => {
    const lowercaseNames = params?.lowercaseNames !== false
    const indent = normalizeIndent(params?.indent)
    const raw = String(input ?? '')

    const result: Record<string, unknown> = {}
    const headers: Record<string, HeaderValue> = {}

    // name(lowercase) -> { display, values }
    const seen = new Map<string, { display: string; values: string[] }>()

    const all = splitLines(raw)
    let start = 0
    while (start < all.length && isBlank(all[start])) start++
    let end = start
    while (end < all.length && !isBlank(all[end])) end++

    const lines = unfold(all.slice(start, end))

    if (lines.length > 0) {
      const first = lines[0].trim()
      const response = RESPONSE_LINE_RE.exec(first)
      const request = response ? null : REQUEST_LINE_RE.exec(first)

      if (response) {
        result.startLine = first
        result.httpVersion = response[1].toUpperCase()
        result.status = Number(response[2])
        result.statusText = (response[3] ?? '').trim()
        lines.shift()
      } else if (request && (request[3] || KNOWN_METHODS.has(request[1].toUpperCase()))) {
        result.startLine = first
        result.method = request[1].toUpperCase()
        result.path = request[2]
        if (request[3]) result.httpVersion = request[3].toUpperCase()
        lines.shift()
      }
    }

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue
      // an HTTP/2 pseudo-header owns its leading colon, so look for the
      // name/value separator after it
      const colon = trimmed.indexOf(':', trimmed.startsWith(':') ? 1 : 0)
      if (colon < 0) throw new Error(`malformed header line (no "name: value" colon): ${trimmed}`)
      const name = trimmed.slice(0, colon)
      const value = trimmed.slice(colon + 1).trim()
      if (!HEADER_NAME_RE.test(name)) throw new Error(`invalid header name: "${name}"`)

      const key = name.toLowerCase()
      const bucket = seen.get(key)
      if (bucket) bucket.values.push(value)
      else seen.set(key, { display: name, values: [value] })
    }

    for (const [key, { display, values }] of seen) {
      headers[lowercaseNames ? key : display] = values.length === 1 ? values[0] : values
    }
    result.headers = headers

    return indent === 2 ? result : JSON.stringify(result, null, indent)
  }
}

export default util
