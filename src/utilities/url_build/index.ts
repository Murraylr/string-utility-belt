import type { Utility } from '@/types/utility'
import { isBytes } from '../helpers'

/** Schemes whose authority is written after `//`. */
const SLASHED = new Set(['http', 'https', 'ws', 'wss', 'ftp', 'file'])
/** Schemes that are meaningless without a host. */
const HOST_REQUIRED = new Set(['http', 'https', 'ws', 'wss', 'ftp'])

/** Keys that mean "build me from parts" rather than "just echo href". */
const PART_KEYS = [
  'protocol',
  'origin',
  'host',
  'hostname',
  'port',
  'pathname',
  'pathSegments',
  'search',
  'searchParams',
  'hash',
  'username',
  'password'
]

const str = (v: unknown): string => (v === null || v === undefined ? '' : String(v))

/** Coerce whatever the pipeline handed us into a plain parts object. */
function toParts(input: unknown): Record<string, unknown> {
  if (input === null || input === undefined) return {}
  let value: unknown = input
  if (isBytes(value)) {
    value = new TextDecoder().decode(value as Uint8Array)
  }
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return {}
    try {
      value = JSON.parse(trimmed)
    } catch {
      throw new Error('url build expects a JSON object of URL parts (the output of url parse)')
    }
  }
  // `JSON.parse('null')` yields null, and `typeof null === 'object'` — without
  // this guard it would slip through and blow up in `Object.keys` with a raw
  // TypeError. A null document carries no parts, so treat it as empty input.
  if (value === null) return {}
  if (Array.isArray(value)) {
    throw new Error('url build expects a JSON object of URL parts, not an array')
  }
  if (typeof value !== 'object') {
    throw new Error('url build expects a JSON object of URL parts (the output of url parse)')
  }
  return value as Record<string, unknown>
}

/** Render `{ a: '1', b: ['2','3'] }` as `a=1&b=2&b=3`. */
function buildQuery(sp: Record<string, unknown>, encode: boolean): string {
  const parts: string[] = []
  for (const [key, value] of Object.entries(sp)) {
    const values = Array.isArray(value) ? value : [value]
    for (const item of values) {
      const rendered =
        item === null || item === undefined
          ? ''
          : typeof item === 'object'
            ? JSON.stringify(item)
            : String(item)
      const k = encode ? encodeURIComponent(key) : key
      const v = encode ? encodeURIComponent(rendered) : rendered
      parts.push(`${k}=${v}`)
    }
  }
  return parts.join('&')
}

const util: Utility = {
  id: 'url_build',
  name: 'url build',
  category: 'Web & Dev',
  description:
    'Assemble a URL string from JSON parts (protocol, host, path segments, query params, hash), optionally percent-encoding segments and query values.',
  accepts: 'json',
  produces: 'string',
  tags: ['url', 'build', 'assemble', 'construct url', 'from parts', 'url parts'],
  examples: [
    {
      title: 'assemble from protocol/host/path/query',
      input: JSON.stringify({ protocol: 'https', host: 'example.com', pathname: '/a/b', searchParams: { x: '1' } }),
      params: { encode: true },
      output: 'https://example.com/a/b?x=1'
    }
  ],
  params: {
    encode: { kind: 'boolean', label: 'percent-encode parts', default: true }
  },
  apply: (input: any, { encode }: any) => {
    const parts = toParts(input)
    if (Object.keys(parts).length === 0) return ''
    const enc = encode !== false

    const hasParts = PART_KEYS.some((k) => {
      const v = parts[k]
      if (v === undefined || v === null) return false
      if (typeof v === 'string') return v !== ''
      if (Array.isArray(v)) return v.length > 0
      if (typeof v === 'object') return Object.keys(v as object).length > 0
      return true
    })
    if (!hasParts) return str(parts.href)

    let protocol = str(parts.protocol).trim()
    let host = str(parts.host).trim()
    const hostname = str(parts.hostname).trim()
    const port = str(parts.port).trim()
    if (!host && hostname) host = port ? `${hostname}:${port}` : hostname

    // `origin` alone is enough to recover protocol + host
    if ((!protocol || !host) && str(parts.origin)) {
      try {
        const o = new URL(str(parts.origin))
        if (!protocol) protocol = o.protocol
        if (!host) host = o.host
      } catch {
        // an unusable origin is simply ignored; protocol/host may still be given directly
      }
    }
    if (protocol && !protocol.endsWith(':')) protocol += ':'

    // Userinfo is left raw: the URL parser below applies the correct
    // userinfo escape set, and re-encoding here would double-escape a
    // username that url_parse already handed back percent-encoded.
    const username = str(parts.username)
    const password = str(parts.password)
    const auth = username || password ? `${username}${password ? `:${password}` : ''}@` : ''

    // `pathname` (already escaped by url_parse) wins over `pathSegments`
    // (decoded, so they are the ones that need encoding).
    let pathname = ''
    if (parts.pathname !== undefined && parts.pathname !== null && str(parts.pathname) !== '') {
      pathname = str(parts.pathname)
    } else if (Array.isArray(parts.pathSegments)) {
      const segs = parts.pathSegments.map((s) => (enc ? encodeURIComponent(str(s)) : str(s)))
      pathname = segs.length ? `/${segs.join('/')}` : ''
    }
    if (host && pathname && !pathname.startsWith('/')) pathname = `/${pathname}`

    let search = ''
    const sp = parts.searchParams
    if (sp && typeof sp === 'object' && !Array.isArray(sp) && Object.keys(sp).length > 0) {
      search = buildQuery(sp as Record<string, unknown>, enc)
    } else if (str(parts.search)) {
      search = str(parts.search).replace(/^\?/, '')
    }

    let hash = str(parts.hash)
    if (hash && !hash.startsWith('#')) hash = `#${hash}`

    let out = ''
    if (protocol) {
      const scheme = protocol.slice(0, -1).toLowerCase()
      if (host) {
        out = `${protocol}//${auth}${host}`
      } else if (SLASHED.has(scheme)) {
        if (HOST_REQUIRED.has(scheme)) {
          throw new Error(`url build: "${scheme}" URLs need a host or hostname`)
        }
        out = `${protocol}//${auth}`
      } else {
        // mailto:, tel:, urn: … no authority at all
        out = protocol
      }
    } else if (host) {
      out = `//${auth}${host}`
    }

    out += pathname
    if (search) out += `?${search}`
    out += hash
    if (!out) return ''

    if (protocol) {
      let normalized: string
      try {
        normalized = new URL(out).href
      } catch {
        throw new Error(`url build: parts produced an invalid URL: ${out}`)
      }
      // With encoding off the user asked for their literal text back,
      // so skip the parser's normalisation.
      return enc ? normalized : out
    }
    return out
  }
}

export default util
