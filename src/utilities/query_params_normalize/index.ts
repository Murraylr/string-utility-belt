import type { Utility } from '@/types/utility'

type Pair = {
  /** exactly as it appeared in the input */
  rawKey: string
  rawVal: string
  /** whether the pair actually had an `=` */
  hasEq: boolean
  /** percent-decoded forms, used for comparing / sorting / matching */
  key: string
  val: string
}

/** Decode a query component, reporting broken escapes instead of swallowing them. */
function decodeComponent(s: string, strict: boolean): string {
  try {
    return decodeURIComponent(s.replace(/\+/g, ' '))
  } catch {
    if (strict) throw new Error(`invalid percent-encoding in query: ${s}`)
    return s
  }
}

/** `utm_*` becomes /^utm_.*$/i — `*` is the only wildcard, everything else is literal. */
function globToRegExp(pattern: string): RegExp {
  const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`^${pattern.split('*').map(escapeRe).join('.*')}$`, 'i')
}

/**
 * Does this authority-shaped token actually look like a host? Used only for
 * scheme-less input, where `EXAMPLE.com/path` should be lowercased but the
 * relative path `Docs/Guide.html` must not be.
 */
const HOSTISH = /^(?:localhost|\[[0-9A-Fa-f:.]+\]|[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+)(?::\d+)?$/

/**
 * Lowercase the scheme and host of a URL prefix, leaving the path, the
 * userinfo and any scheme-less relative path untouched.
 */
function lowercaseHostIn(head: string): string {
  const withAuthority = /^([A-Za-z][A-Za-z0-9+.-]*:)?\/\/([^/?#]*)([\s\S]*)$/.exec(head)
  if (withAuthority) {
    const scheme = (withAuthority[1] || '').toLowerCase()
    const authority = withAuthority[2]
    const rest = withAuthority[3]
    const at = authority.lastIndexOf('@')
    const userinfo = at >= 0 ? authority.slice(0, at + 1) : ''
    const hostport = at >= 0 ? authority.slice(at + 1) : authority
    return `${scheme}//${userinfo}${hostport.toLowerCase()}${rest}`
  }
  const schemeOnly = /^([A-Za-z][A-Za-z0-9+.-]*:)([\s\S]*)$/.exec(head)
  if (schemeOnly) return schemeOnly[1].toLowerCase() + schemeOnly[2]
  // Scheme-less `EXAMPLE.com/path` — only safe to touch when a path follows AND
  // the first segment really is host-shaped, otherwise a relative path like
  // `Docs/Guide.html` would silently lose the case of its first directory.
  const slash = head.indexOf('/')
  if (slash > 0) {
    const authority = head.slice(0, slash)
    const at = authority.lastIndexOf('@')
    const userinfo = at >= 0 ? authority.slice(0, at + 1) : ''
    const hostport = at >= 0 ? authority.slice(at + 1) : authority
    if (HOSTISH.test(hostport)) return `${userinfo}${hostport.toLowerCase()}${head.slice(slash)}`
  }
  return head
}

/** Does this look like a URL/path rather than a bare `a=1&b=2` string? */
const looksLikeUrl = (s: string): boolean =>
  /^[A-Za-z][A-Za-z0-9+.-]*:/.test(s) ||
  s.startsWith('//') ||
  s.startsWith('/') ||
  (s.includes('/') && !s.includes('='))

const util: Utility = {
  id: 'query_params_normalize',
  name: 'normalize query params',
  category: 'Web & Dev',
  description:
    'Sort, dedupe and drop query parameters so two URLs can be compared — works on a full URL or a bare query string, with wildcard drop patterns like utm_*.',
  accepts: 'string',
  produces: 'string',
  tags: ['query string', 'url', 'sort params', 'dedupe', 'canonicalize', 'utm', 'tracking params'],
  examples: [
    {
      title: 'sort, lowercase host, drop utm_*',
      input: 'https://Example.com/path?b=2&a=1&utm_source=x',
      params: { drop: 'utm_*' },
      output: 'https://example.com/path?a=1&b=2'
    }
  ],
  params: {
    sort: { kind: 'boolean', label: 'sort by key', default: true },
    dedupe: { kind: 'select', label: 'dedupe repeated keys', options: ['none', 'first', 'last'], default: 'last' },
    dropEmpty: { kind: 'boolean', label: 'drop empty values', default: false },
    drop: { kind: 'string', label: 'drop keys (comma list, * allowed)', default: '', placeholder: 'utm_*,fbclid' },
    decode: { kind: 'boolean', label: 'decode values', default: false },
    lowercaseHost: { kind: 'boolean', label: 'lowercase scheme + host', default: true }
  },
  apply: (input: any, { sort, dedupe, dropEmpty, drop, decode, lowercaseHost }: any) => {
    const raw = String(input ?? '').trim()
    if (!raw) return ''

    const doSort = sort !== false
    const dedupeMode = String(dedupe ?? 'last')
    const doDropEmpty = dropEmpty === true
    const doDecode = decode === true
    const doLowercaseHost = lowercaseHost !== false

    // ---- split into head / query / hash --------------------------------
    const hashIdx = raw.indexOf('#')
    const hash = hashIdx >= 0 ? raw.slice(hashIdx) : ''
    const beforeHash = hashIdx >= 0 ? raw.slice(0, hashIdx) : raw
    const qIdx = beforeHash.indexOf('?')

    let head = ''
    let query = ''
    let hadQuestionMark = false
    if (qIdx >= 0) {
      head = beforeHash.slice(0, qIdx)
      query = beforeHash.slice(qIdx + 1)
      hadQuestionMark = true
    } else if (looksLikeUrl(beforeHash)) {
      head = beforeHash
    } else {
      query = beforeHash
    }

    // ---- parse pairs ---------------------------------------------------
    let pairs: Pair[] = []
    for (const chunk of query.split('&')) {
      if (!chunk) continue
      const eq = chunk.indexOf('=')
      const rawKey = eq >= 0 ? chunk.slice(0, eq) : chunk
      const rawVal = eq >= 0 ? chunk.slice(eq + 1) : ''
      pairs.push({
        rawKey,
        rawVal,
        hasEq: eq >= 0,
        key: decodeComponent(rawKey, doDecode),
        val: decodeComponent(rawVal, doDecode)
      })
    }

    // ---- drop by name ---------------------------------------------------
    const patterns = String(drop ?? '')
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean)
      .map(globToRegExp)
    // Match against both forms: the decoded key so `utm_*` catches `%75tm_source`,
    // and the raw key so a pattern the user copied out of the URL (`a+b`, `a%20b`)
    // still matches the text they actually saw.
    if (patterns.length) {
      pairs = pairs.filter((p) => !patterns.some((re) => re.test(p.key) || re.test(p.rawKey)))
    }

    // ---- drop empty ------------------------------------------------------
    if (doDropEmpty) pairs = pairs.filter((p) => p.val !== '')

    // ---- dedupe ----------------------------------------------------------
    if (dedupeMode === 'first' || dedupeMode === 'last') {
      const keep = new Map<string, number>()
      pairs.forEach((p, i) => {
        if (dedupeMode === 'last' || !keep.has(p.key)) keep.set(p.key, i)
      })
      const keepIdx = new Set(keep.values())
      pairs = pairs.filter((_, i) => keepIdx.has(i))
    }

    // ---- sort ------------------------------------------------------------
    if (doSort) {
      pairs = [...pairs].sort((a, b) => {
        if (a.key < b.key) return -1
        if (a.key > b.key) return 1
        if (a.val < b.val) return -1
        if (a.val > b.val) return 1
        return 0
      })
    }

    // ---- render ----------------------------------------------------------
    const rendered = pairs
      .map((p) => {
        const k = doDecode ? p.key : p.rawKey
        const v = doDecode ? p.val : p.rawVal
        return p.hasEq ? `${k}=${v}` : k
      })
      .join('&')

    const prefix = doLowercaseHost && head ? lowercaseHostIn(head) : head
    if (!rendered) {
      // a lone `?` survives only when there is nothing else to anchor to
      return prefix + (hadQuestionMark && !prefix && !hash ? '?' : '') + hash
    }
    const separator = prefix || hadQuestionMark ? '?' : ''
    return `${prefix}${separator}${rendered}${hash}`
  }
}

export default util
