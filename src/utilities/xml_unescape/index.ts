import type { Utility } from '@/types/utility'

/** The five predefined entities — the only names XML defines without a DTD. */
const PREDEFINED: Record<string, string> = {
  quot: '"',
  amp: '&',
  apos: "'",
  lt: '<',
  gt: '>'
}

/** Longest predefined name (`quot` / `apos`), used to bound the scan after an `&`. */
const MAX_NAME_LENGTH = Object.keys(PREDEFINED).reduce((m, n) => Math.max(m, n.length), 0)

const isDecDigit = (c: string) => c >= '0' && c <= '9'
const isHexDigit = (c: string) => isDecDigit(c) || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F')

/** XML 1.0 §2.2 Char production — a reference to anything else is a fatal error. */
const isXmlChar = (cp: number) =>
  cp === 0x09 ||
  cp === 0x0a ||
  cp === 0x0d ||
  (cp >= 0x20 && cp <= 0xd7ff) ||
  (cp >= 0xe000 && cp <= 0xfffd) ||
  (cp >= 0x10000 && cp <= 0x10ffff)

const fromCodePoint = (cp: number, ref: string) => {
  if (!Number.isFinite(cp) || cp > 0x10ffff) throw new Error(`character reference out of range: ${ref}`)
  if (!isXmlChar(cp)) throw new Error(`${ref} refers to a code point that is not legal in XML 1.0`)
  return String.fromCodePoint(cp)
}

type Ref = { text: string; next: number }

/**
 * Parse the reference starting at `s[at] === '&'`.
 * XML requires the trailing semicolon, so anything else is left verbatim —
 * including named entities XML does not define (`&nbsp;` stays `&nbsp;`).
 */
const parseReference = (s: string, at: number): Ref | null => {
  if (s[at + 1] === '#') {
    let j = at + 2
    let radix = 10
    if (s[j] === 'x' || s[j] === 'X') {
      radix = 16
      j++
    }
    const start = j
    while (j < s.length && (radix === 16 ? isHexDigit(s[j]) : isDecDigit(s[j]))) j++
    if (j === start || s[j] !== ';') return null
    const digits = s.slice(start, j)
    const ref = `&#${radix === 16 ? 'x' : ''}${digits};`
    return { text: fromCodePoint(parseInt(digits, radix), ref), next: j + 1 }
  }

  // Bounded scan: the longest predefined name is 4 characters (`quot` / `apos`),
  // so never look further than that — an unbounded indexOf(';') would make a run
  // of bare ampersands quadratic, and the pipeline re-runs on every keystroke.
  const limit = Math.min(s.length, at + 1 + MAX_NAME_LENGTH)
  let j = at + 1
  while (j < limit && s[j] !== ';') j++
  if (s[j] !== ';') return null
  const name = s.slice(at + 1, j)
  const value = Object.prototype.hasOwnProperty.call(PREDEFINED, name) ? PREDEFINED[name] : undefined
  return value === undefined ? null : { text: value, next: j + 1 }
}

const util: Utility = {
  id: 'xml_unescape',
  name: 'xml unescape',
  category: 'Decoding',
  description:
    'Resolve the five predefined XML entities plus &#decimal; and &#xHEX; references back to text, leaving anything else untouched.',
  accepts: 'string',
  produces: 'string',
  tags: ['xml', 'entity', 'decode', 'unescape', 'entities'],
  aliases: ['xml_entity_decode'],
  streamable: true,
  params: {},
  examples: [
    { title: 'predefined entities', input: '&lt;a&gt;Tom &amp; Jerry&lt;/a&gt;', output: '<a>Tom & Jerry</a>' },
    { title: 'numeric references', input: 'x&#65;&#x42;y', output: 'xABy' }
  ],
  apply: (input: any) => {
    const s = input === null || input === undefined ? '' : String(input)
    if (!s) return ''

    let out = ''
    let i = 0
    while (i < s.length) {
      const amp = s.indexOf('&', i)
      if (amp === -1) {
        out += s.slice(i)
        break
      }
      out += s.slice(i, amp)
      const ref = parseReference(s, amp)
      if (ref) {
        out += ref.text
        i = ref.next
      } else {
        out += '&'
        i = amp + 1
      }
    }
    return out
  }
}

export default util
