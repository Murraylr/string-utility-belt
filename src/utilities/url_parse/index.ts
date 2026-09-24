import type { Utility } from '@/types/utility'

/** Percent-decode a query component (`+` means space in `application/x-www-form-urlencoded`). */
const decodeQueryPart = (s: string): string => {
  try {
    return decodeURIComponent(s.replace(/\+/g, ' '))
  } catch {
    // malformed escapes (`%zz`) stay as-is rather than blowing up the whole parse
    return s
  }
}

/** Percent-decode a path segment (`+` is a literal plus in paths). */
const decodePathPart = (s: string): string => {
  try {
    return decodeURIComponent(s)
  } catch {
    return s
  }
}

/**
 * Parse a `?a=1&a=2&b=3` string into `{ a: ['1','2'], b: '3' }`.
 * Built on a null-prototype object so keys like `__proto__`/`constructor`
 * cannot collide with Object.prototype, then flattened to a plain object.
 */
export function parseQuery(search: string, decode: boolean): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = Object.create(null)
  const q = search.startsWith('?') ? search.slice(1) : search
  if (!q) return {}
  for (const pair of q.split('&')) {
    if (!pair) continue
    const eq = pair.indexOf('=')
    const rawKey = eq >= 0 ? pair.slice(0, eq) : pair
    const rawVal = eq >= 0 ? pair.slice(eq + 1) : ''
    const key = decode ? decodeQueryPart(rawKey) : rawKey
    const val = decode ? decodeQueryPart(rawVal) : rawVal
    if (Object.prototype.hasOwnProperty.call(out, key)) {
      const cur = out[key]
      out[key] = Array.isArray(cur) ? [...cur, val] : [cur as string, val]
    } else {
      out[key] = val
    }
  }
  return { ...out }
}

const splitSegments = (pathname: string, decode: boolean): string[] =>
  pathname
    .split('/')
    .filter(Boolean)
    .map((s) => (decode ? decodePathPart(s) : s))

/** Anything of the form `scheme:` is a bid to be an absolute URL. */
const HAS_SCHEME = /^[A-Za-z][A-Za-z0-9+.-]*:/

/**
 * `URL#origin` serialises an *opaque* origin as the four-character string
 * `"null"` (mailto:, file:, data:, tel: …). Reporting that verbatim would tell
 * a consumer the origin is a host called "null", so report "no origin" the same
 * way the relative-reference branch does: an empty string.
 */
const originOf = (url: URL): string => (url.origin === 'null' ? '' : url.origin)

/**
 * Only used to give a network-path reference (`//example.com/a`) a scheme long
 * enough for the URL parser to find the authority. `.invalid` is reserved by
 * RFC 2606, so it can never collide with a real host.
 */
const NETWORK_PATH_BASE = 'https://network-path-reference.invalid/'

type Parts = Record<string, unknown>

/** Project a parsed `URL` onto the documented parts object. */
const partsOf = (
  url: URL,
  decode: boolean,
  overrides: { href?: string; protocol?: string; origin?: string; isAbsolute: boolean }
): Parts => ({
  href: overrides.href ?? url.href,
  protocol: overrides.protocol ?? url.protocol,
  username: url.username,
  password: url.password,
  host: url.host,
  hostname: url.hostname,
  port: url.port,
  pathname: url.pathname,
  pathSegments: splitSegments(url.pathname, decode),
  search: url.search,
  searchParams: parseQuery(url.search, decode),
  hash: url.hash,
  origin: overrides.origin ?? originOf(url),
  isAbsolute: overrides.isAbsolute
})

const util: Utility = {
  id: 'url_parse',
  name: 'url parse',
  category: 'Web & Dev',
  description:
    'Break a URL into JSON parts — protocol, host, port, path segments, query params and hash — resolving relative URLs against an optional base.',
  accepts: 'string',
  produces: 'json',
  tags: ['url', 'parse', 'parts', 'query params', 'hostname', 'pathname', 'uri'],
  examples: [
    {
      title: 'full URL with auth, query and hash',
      input: 'https://user:pw@example.com:8080/a/b?x=1&y=2#frag',
      output:
        '{\n  "href": "https://user:pw@example.com:8080/a/b?x=1&y=2#frag",\n  "protocol": "https:",\n  "username": "user",\n  "password": "pw",\n  "host": "example.com:8080",\n  "hostname": "example.com",\n  "port": "8080",\n  "pathname": "/a/b",\n  "pathSegments": [\n    "a",\n    "b"\n  ],\n  "search": "?x=1&y=2",\n  "searchParams": {\n    "x": "1",\n    "y": "2"\n  },\n  "hash": "#frag",\n  "origin": "https://example.com:8080",\n  "isAbsolute": true\n}'
    }
  ],
  params: {
    base: { kind: 'string', label: 'base url', default: '', placeholder: 'https://example.com/docs/' },
    decodeParams: { kind: 'boolean', label: 'decode percent-encoding', default: true }
  },
  apply: (input: any, { base, decodeParams }: any) => {
    const raw = String(input ?? '').trim()
    // an empty box is not an error the user needs to see yet
    if (!raw) return {}

    const decode = decodeParams !== false
    const baseStr = String(base ?? '').trim()

    let url: URL | null = null
    let isAbsolute = false
    try {
      url = new URL(raw)
      isAbsolute = true
    } catch {
      url = null
    }

    if (!url && baseStr) {
      try {
        url = new URL(raw, baseStr)
      } catch {
        throw new Error(`invalid URL: cannot resolve ${JSON.stringify(raw)} against base ${JSON.stringify(baseStr)}`)
      }
    }

    if (url) {
      return partsOf(url, decode, { isAbsolute })
    }

    // Network-path reference (`//example.com/a`): `example.com` is a real
    // authority, not a path segment. Borrow a scheme so the parser splits
    // host/port/userinfo properly, then hand back a scheme-less result.
    // `///a/b` is an *empty* authority followed by a path — the special-scheme
    // parser would greedily eat `a` as the host, so leave it to the path split.
    if (raw.startsWith('//') && !raw.startsWith('///')) {
      try {
        const resolved = new URL(raw, NETWORK_PATH_BASE)
        if (resolved.host) {
          return partsOf(resolved, decode, { href: raw, protocol: '', origin: '', isAbsolute: false })
        }
      } catch {
        // not a usable authority — fall through to the generic relative split
      }
    }

    // It carried a scheme but the URL parser rejected it — that is a real error,
    // not a relative reference.
    if (HAS_SCHEME.test(raw)) {
      throw new Error(`invalid URL: ${raw}`)
    }

    // Relative reference with no base: split it by hand so `/a/b?x=1#f` still
    // yields usable path segments and query params.
    const hashIdx = raw.indexOf('#')
    const hash = hashIdx >= 0 ? raw.slice(hashIdx) : ''
    const beforeHash = hashIdx >= 0 ? raw.slice(0, hashIdx) : raw
    const qIdx = beforeHash.indexOf('?')
    const search = qIdx >= 0 ? beforeHash.slice(qIdx) : ''
    const pathname = qIdx >= 0 ? beforeHash.slice(0, qIdx) : beforeHash

    return {
      href: raw,
      protocol: '',
      username: '',
      password: '',
      host: '',
      hostname: '',
      port: '',
      pathname,
      pathSegments: splitSegments(pathname, decode),
      search,
      searchParams: parseQuery(search, decode),
      hash,
      origin: '',
      isAbsolute: false
    }
  }
}

export default util
