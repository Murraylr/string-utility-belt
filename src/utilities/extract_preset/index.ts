import type { Utility } from '@/types/utility'

const TYPES = [
  'urls', 'emails', 'ipv4', 'ipv6', 'numbers', 'integers', 'hashtags', 'mentions',
  'hex-colors', 'uuids', 'quoted-strings', 'dates', 'times', 'phone', 'html-tags',
  'words', 'domains', 'file-paths', 'credit-cards', 'jwt'
]

const MONTHS = '(?:jan|feb|mar|apr|may|jun|jul|aug|sept?|oct|nov|dec)[a-z]*\\.?'

const RE_URL = /(?:https?|ftps?|file|wss?):\/\/[^\s<>"'`]+|\bwww\.[a-z0-9-]+(?:\.[a-z0-9-]+)+(?:\/[^\s<>"'`]*)?/gi
const RE_EMAIL = /[a-z0-9._%+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,24}\b/gi
const RE_IPV4 = /\b(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\b/g
const V6_GROUP = '[0-9a-f]{1,4}'
const V6_SEQ = `${V6_GROUP}(?::${V6_GROUP})*`
const V4_OCTETS =
  '(?:(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)\\.){3}(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)'
// Alternatives are ordered longest-form first: JS alternation takes the first
// branch that matches, so putting `a:b::` before `a:b::c` would truncate the tail.
const RE_IPV6 = new RegExp(
  '(?<![0-9a-z:.])(?:' +
    [
      `(?:${V6_SEQ})?::(?:${V6_SEQ}:)?${V4_OCTETS}`, // ::ffff:192.168.0.1
      `(?:${V6_GROUP}:){6}${V4_OCTETS}`, // 0:0:0:0:0:ffff:192.168.0.1
      `(?:${V6_GROUP}:){7}${V6_GROUP}`, // full eight groups
      `${V6_SEQ}::(?:${V6_SEQ})?`, // 2001:db8::1 / fe80::
      `::${V6_SEQ}` // ::1
    ].join('|') +
    ')(?![0-9a-z:])',
  'gi'
)
const RE_NUMBER = /[-+]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?(?:[eE][-+]?\d+)?/g
// an integer is a digit run that is not part of a decimal number
const RE_INTEGER = /(?<![\d.])[-+]?\d+(?!\.?\d)/g
const RE_HASHTAG = /#[\p{L}\p{N}_]+/gu
const RE_MENTION = /(?<![\p{L}\p{N}._%+-])@[\p{L}\p{N}_][\p{L}\p{N}_.-]*/gu
const RE_HEXCOLOR = /#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})\b/gi
const RE_UUID = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi
const RE_QUOTED = /"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|`((?:[^`\\]|\\.)*)`|“([^”]*)”|‘([^’]*)’/g
const RE_DATE = new RegExp(
  [
    // digit lookarounds rather than \b, so the date inside 2024-03-01T10:00:00Z still matches
    '(?<!\\d)\\d{4}-\\d{1,2}-\\d{1,2}(?!\\d)',
    '(?<!\\d)\\d{4}[/.]\\d{1,2}[/.]\\d{1,2}(?!\\d)',
    '(?<!\\d)\\d{1,2}[/.-]\\d{1,2}[/.-]\\d{2,4}(?!\\d)',
    `\\b${MONTHS}\\s+\\d{1,2}(?:st|nd|rd|th)?,?\\s+\\d{4}\\b`,
    `\\b\\d{1,2}(?:st|nd|rd|th)?\\s+${MONTHS}\\s+\\d{4}\\b`
  ].join('|'),
  'gi'
)
// the clock part is guarded by digit/colon lookarounds rather than \b: in 2024-03-01T10:00:00Z
// a \b would refuse the "T10" boundary and match the middle of the timestamp instead
const RE_TIME =
  /(?<![\d:])(?:[01]?\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,9})?)?(?:\s*[ap]\.?m\.?)?(?:\s*(?:Z|[-+]\d{2}:?\d{2}))?(?![\d:])|\b(?:1[0-2]|0?[1-9])\s*[ap]\.?m\.?/gi
const RE_PHONE = /(?:\+\d{1,3}[ .-]?)?(?:\(\d{1,4}\)[ .-]?)?\d{1,4}(?:[ .-]\d{2,5}){1,4}|\+\d{7,15}/g
// attribute values are parsed properly so a `>` inside them does not end the tag early. Each
// attribute is atomic (`(?=(…))\1`): whitespace and `=` could otherwise be split between an
// empty value and the next attribute in exponentially many ways before a match fails
const RE_HTMLTAG =
  /<!--[\s\S]*?-->|<\/?[a-z][a-z0-9:._-]*(?:\s+(?=([^\s"'>/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'`>]*))?))\1)*\s*\/?>/gi
const RE_WORD = /[\p{L}\p{M}\p{N}]+(?:['’-][\p{L}\p{M}\p{N}]+)*/gu
const RE_DOMAIN = /\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}\b/gi
const RE_PATH = /(?<![:\w/])(?:[a-z]:[\\/]|~\/|\.{1,2}\/|\/)[^\s"'<>|]*/gi
const RE_CC = /\b(?:\d[- ]?){12,18}\d\b/g
const RE_JWT = /\beyJ[a-z0-9_-]+\.[a-z0-9_-]+(?:\.[a-z0-9_-]*)?/gi

/** Trailing sentence punctuation is almost never part of a URL or a path. */
function trimTrailing(s: string): string {
  let out = s.replace(/[.,;:!?'"’”]+$/u, '')
  while (out.endsWith(')') && !out.includes('(')) out = out.slice(0, -1)
  return out
}

function digitsOf(s: string): string {
  return s.replace(/\D+/g, '')
}

function luhnValid(digits: string): boolean {
  if (digits.length < 13 || digits.length > 19) return false
  let sum = 0
  let alt = false
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48
    if (alt) {
      d *= 2
      if (d > 9) d -= 9
    }
    sum += d
    alt = !alt
  }
  return sum % 10 === 0
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

function matchAllGroups(s: string, re: RegExp): string[] {
  const out: string[] = []
  for (const m of s.matchAll(re)) {
    for (let i = 1; i < m.length; i++) {
      if (m[i] !== undefined) {
        out.push(m[i])
        break
      }
    }
  }
  return out
}

function extract(kind: string, s: string): string[] {
  switch (kind) {
    case 'urls':
      return (s.match(RE_URL) ?? []).map(trimTrailing).filter(Boolean)
    case 'emails':
      return s.match(RE_EMAIL) ?? []
    case 'ipv4':
      return s.match(RE_IPV4) ?? []
    case 'ipv6':
      return s.match(RE_IPV6) ?? []
    case 'numbers':
      return s.match(RE_NUMBER) ?? []
    case 'integers':
      return s.match(RE_INTEGER) ?? []
    case 'hashtags':
      return s.match(RE_HASHTAG) ?? []
    case 'mentions':
      return s.match(RE_MENTION) ?? []
    case 'hex-colors':
      return s.match(RE_HEXCOLOR) ?? []
    case 'uuids':
      return s.match(RE_UUID) ?? []
    case 'quoted-strings':
      return matchAllGroups(s, RE_QUOTED)
    case 'dates':
      return s.match(RE_DATE) ?? []
    case 'times':
      return (s.match(RE_TIME) ?? []).map((m) => m.trim())
    case 'phone':
      return (s.match(RE_PHONE) ?? [])
        .map((m) => m.trim().replace(/[\s.-]+$/, ''))
        .filter((m) => {
          if (ISO_DATE.test(m)) return false
          const n = digitsOf(m).length
          return n >= 7 && n <= 15
        })
    case 'html-tags':
      return s.match(RE_HTMLTAG) ?? []
    case 'words':
      return s.match(RE_WORD) ?? []
    case 'domains':
      return s.match(RE_DOMAIN) ?? []
    case 'file-paths':
      return (s.match(RE_PATH) ?? []).map(trimTrailing).filter((m) => m.length > 1)
    case 'credit-cards':
      return (s.match(RE_CC) ?? []).filter((m) => luhnValid(digitsOf(m)))
    case 'jwt':
      return s.match(RE_JWT) ?? []
    default:
      throw new Error(`unknown extract type: ${kind}`)
  }
}

/** The separator field is a plain text input, so accept the usual escapes. */
function unescapeSeparator(s: string): string {
  return s.replace(/\\([nrt\\])/g, (_m, c: string) =>
    c === 'n' ? '\n' : c === 'r' ? '\r' : c === 't' ? '\t' : '\\'
  )
}

/**
 * Matches for one type, tagged with a best-effort position in the source text so
 * results from several selected types can be merged in order of appearance. Positions
 * are found with a forward-moving cursor, so they stay non-decreasing within a type
 * even though several helpers here (trimTrailing, luhn filtering, …) drop the index
 * the underlying regex originally matched at.
 */
function extractWithPosition(kind: string, s: string): Array<{ match: string; index: number }> {
  const matches = extract(kind, s)
  const out: Array<{ match: string; index: number }> = []
  let cursor = 0
  for (const m of matches) {
    let idx = m ? s.indexOf(m, cursor) : -1
    if (idx < 0) idx = m ? s.indexOf(m) : cursor
    out.push({ match: m, index: idx })
    if (idx >= 0) cursor = idx + 1
  }
  return out
}

const util: Utility = {
  id: 'extract_preset',
  name: 'extract matches',
  category: 'Analysis',
  description:
    'Pull every url, email, ip, number, uuid or other preset pattern out of the text, with optional dedupe, sort, custom separator, or just the match count.',
  accepts: 'string',
  produces: 'string',
  tags: ['regex extract', 'find matches', 'scrape', 'pull data', 'pattern matching', 'grep'],
  aliases: ['grep -o'],
  params: {
    type: { kind: 'multiselect', label: 'extract', options: TYPES, default: ['urls'] },
    unique: { kind: 'boolean', label: 'unique', default: false },
    sort: { kind: 'boolean', label: 'sort', default: false },
    separator: { kind: 'string', label: 'separator', default: '\n' },
    count: { kind: 'boolean', label: 'count only', default: false }
  },
  examples: [
    {
      title: 'urls',
      input: 'Visit https://example.com and http://test.org today',
      params: { type: 'urls' },
      output: 'https://example.com\nhttp://test.org'
    },
    {
      title: 'several types at once',
      input: 'Email ada@example.com or call 555-123-4567',
      params: { type: ['emails', 'phone'] },
      output: 'ada@example.com\n555-123-4567'
    }
  ],
  apply: (input: any, params: any = {}) => {
    const s = String(input ?? '')
    const rawType = params.type ?? ['urls']
    // A legacy pipeline (or a direct call, as the pre-multiselect API allowed) may
    // still hand a bare string; the runner also wraps that into a one-item array via
    // resolveParams, but apply() must not depend on going through it.
    const types: unknown[] = Array.isArray(rawType) ? rawType : [rawType]
    if (types.length === 0) throw new Error('select at least one type to extract')
    for (const t of types) {
      if (typeof t !== 'string' || !TYPES.includes(t)) {
        throw new Error(`unknown extract type: ${String(t)}`)
      }
    }
    const kinds = types as string[]
    const separator = unescapeSeparator(String(params.separator ?? '\n'))

    let matches: string[]
    if (!s) {
      matches = []
    } else if (kinds.length === 1) {
      matches = extract(kinds[0], s)
    } else {
      // Merge every type's matches by where they first appear in the text, keeping
      // each type's own matches (already left-to-right) stable relative to each other.
      const tagged = kinds.flatMap((k) => extractWithPosition(k, s))
      tagged.sort((a, b) => a.index - b.index)
      matches = tagged.map((t) => t.match)
    }

    if (params.unique) {
      matches = Array.from(new Set(matches))
    }

    if (params.sort) {
      const numeric = kinds.every((k) => k === 'numbers' || k === 'integers')
      matches = matches.slice().sort((a, b) =>
        numeric
          ? Number(a.replace(/,/g, '')) - Number(b.replace(/,/g, ''))
          : a.localeCompare(b)
      )
    }

    if (params.count) return String(matches.length)
    return matches.join(separator)
  }
}

export default util
