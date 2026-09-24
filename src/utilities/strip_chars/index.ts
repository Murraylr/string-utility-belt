import type { Utility } from '@/types/utility'

const TYPES = [
  'punctuation', 'digits', 'letters', 'whitespace', 'non-alphanumeric',
  'non-ascii', 'non-printable', 'emoji', 'custom'
]

const ZWJ = '\u200D'
const KEYCAP = '\u20E3'

const RE_PUNCT = /^\p{P}$/u
const RE_DIGIT = /^\p{N}$/u
const RE_LETTER = /^[\p{L}\p{M}]$/u
const RE_SPACE = /^[\s\u180E\uFEFF]$/u
const RE_ALNUM = /^[\p{L}\p{M}\p{N}]$/u
const RE_FORMAT = /^[\p{Cf}\p{Cs}\p{Co}]$/u
const RE_PICTO = /\p{Extended_Pictographic}/u
const RE_REGIONAL = /[\u{1F1E6}-\u{1F1FF}]/u
const RE_MARK = /^\p{M}$/u

/** \t \n \r are printable enough — stripping them would shred the document. */
const KEEP_CONTROLS = new Set([0x09, 0x0a, 0x0d])

function isNonPrintable(ch: string, cp: number): boolean {
  if (cp <= 0x1f) return !KEEP_CONTROLS.has(cp)
  if (cp === 0x7f) return true
  if (cp >= 0x80 && cp <= 0x9f) return true
  return RE_FORMAT.test(ch)
}

function isEmojiCluster(cluster: string): boolean {
  return RE_PICTO.test(cluster) || RE_REGIONAL.test(cluster) || cluster.includes(KEYCAP)
}

type SegmenterCtor = new (
  locale?: string,
  options?: { granularity?: string }
) => { segment(s: string): Iterable<{ segment: string }> }

/**
 * Emoji are matched per grapheme cluster so a flag, a skin-tone modifier or a
 * ZWJ family sequence is removed as one unit instead of leaving orphan halves.
 */
function graphemes(s: string): string[] {
  const Segmenter = (Intl as unknown as { Segmenter?: SegmenterCtor }).Segmenter
  if (Segmenter) {
    const seg = new Segmenter('en', { granularity: 'grapheme' })
    return Array.from(seg.segment(s), (p) => p.segment)
  }
  // fallback: glue combining marks, ZWJ sequences and variation selectors onto the base
  const out: string[] = []
  for (const ch of Array.from(s)) {
    const cp = ch.codePointAt(0) as number
    const joinable =
      RE_MARK.test(ch) ||
      (cp >= 0xfe00 && cp <= 0xfe0f) ||
      (cp >= 0x1f3fb && cp <= 0x1f3ff) ||
      cp === 0x200d ||
      cp === 0x20e3
    const prevJoins = out.length > 0 && out[out.length - 1].endsWith(ZWJ)
    if (out.length && (joinable || prevJoins)) out[out.length - 1] += ch
    else out.push(ch)
  }
  return out
}

function matcherFor(type: string, custom: string): (token: string) => boolean {
  switch (type) {
    case 'punctuation':
      return (t) => RE_PUNCT.test(t)
    case 'digits':
      return (t) => RE_DIGIT.test(t)
    case 'letters':
      return (t) => RE_LETTER.test(t)
    case 'whitespace':
      return (t) => RE_SPACE.test(t)
    case 'non-alphanumeric':
      return (t) => !RE_ALNUM.test(t)
    case 'non-ascii':
      return (t) => (t.codePointAt(0) as number) > 0x7f
    case 'non-printable':
      return (t) => isNonPrintable(t, t.codePointAt(0) as number)
    case 'emoji':
      return isEmojiCluster
    case 'custom': {
      const set = new Set(Array.from(custom))
      return (t) => set.has(t)
    }
    default:
      throw new Error(`unknown strip type: ${type}`)
  }
}

const util: Utility = {
  id: 'strip_chars',
  name: 'strip characters',
  category: 'String Ops',
  description:
    'Remove punctuation, digits, letters, whitespace, non-ascii, non-printable, emoji or your own set of characters — invert to keep only those, and optionally replace instead of delete.',
  accepts: 'string',
  produces: 'string',
  tags: ['remove characters', 'filter characters', 'strip punctuation', 'remove emoji', 'character filter', 'unicode strip'],
  examples: [
    { title: 'strip punctuation', input: 'Hello, World! 123', params: { type: 'punctuation', custom: '', invert: false, replaceWith: '' }, output: 'Hello World 123' }
  ],
  params: {
    type: { kind: 'select', label: 'strip', options: TYPES, default: 'punctuation' },
    custom: { kind: 'string', label: 'custom characters', default: '', placeholder: 'e.g. -_/' },
    invert: { kind: 'boolean', label: 'invert (keep only these)', default: false },
    replaceWith: { kind: 'string', label: 'replace with', default: '' }
  },
  apply: (input: any, params: any = {}) => {
    const s = String(input ?? '')
    const type = params.type ?? 'punctuation'
    const custom = String(params.custom ?? '')
    const invert = Boolean(params.invert)
    const replaceWith = String(params.replaceWith ?? '')

    if (typeof type !== 'string' || !TYPES.includes(type)) {
      throw new Error(`unknown strip type: ${String(type)}`)
    }
    // empty input is never an error, whatever the params say
    if (!s) return ''
    if (type === 'custom' && custom === '') {
      throw new Error('custom character set is empty — fill in "custom characters"')
    }

    const matches = matcherFor(type, custom)
    const tokens = type === 'emoji' ? graphemes(s) : Array.from(s)

    let out = ''
    for (const token of tokens) {
      const hit = matches(token)
      out += (invert ? !hit : hit) ? replaceWith : token
    }
    return out
  }
}

export default util
