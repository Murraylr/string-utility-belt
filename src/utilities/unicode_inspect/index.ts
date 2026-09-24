import type { Utility } from '@/types/utility'

/**
 * Per-code-point Unicode inspector.
 *
 * General category and script come from RegExp Unicode property escapes
 * (`\p{General_Category=Lu}` / `\p{Script=Latin}`) — a platform feature, so the data
 * always matches the engine's Unicode version instead of a table that rots. Block
 * names have no property escape in JavaScript, so those are a hand-rolled range table.
 */

type Row = {
  index: number
  char: string
  codePoint: string
  decimal: number
  utf8: string
  utf16: string
  category: string
  categoryName: string
  script: string
  block: string
  isCombining: boolean
  isEmoji: boolean
}

const encoder = new TextEncoder()

const CATEGORY_NAMES: Record<string, string> = {
  Lu: 'Uppercase Letter',
  Ll: 'Lowercase Letter',
  Lt: 'Titlecase Letter',
  Lm: 'Modifier Letter',
  Lo: 'Other Letter',
  Mn: 'Nonspacing Mark',
  Mc: 'Spacing Mark',
  Me: 'Enclosing Mark',
  Nd: 'Decimal Number',
  Nl: 'Letter Number',
  No: 'Other Number',
  Pc: 'Connector Punctuation',
  Pd: 'Dash Punctuation',
  Ps: 'Open Punctuation',
  Pe: 'Close Punctuation',
  Pi: 'Initial Punctuation',
  Pf: 'Final Punctuation',
  Po: 'Other Punctuation',
  Sm: 'Math Symbol',
  Sc: 'Currency Symbol',
  Sk: 'Modifier Symbol',
  So: 'Other Symbol',
  Zs: 'Space Separator',
  Zl: 'Line Separator',
  Zp: 'Paragraph Separator',
  Cc: 'Control',
  Cf: 'Format',
  Cs: 'Surrogate',
  Co: 'Private Use',
  Cn: 'Unassigned',
}

const SCRIPT_NAMES = [
  'Latin', 'Greek', 'Cyrillic', 'Arabic', 'Hebrew', 'Han', 'Hiragana', 'Katakana', 'Hangul',
  'Devanagari', 'Bengali', 'Gurmukhi', 'Gujarati', 'Oriya', 'Tamil', 'Telugu', 'Kannada',
  'Malayalam', 'Sinhala', 'Thai', 'Lao', 'Tibetan', 'Myanmar', 'Georgian', 'Armenian',
  'Ethiopic', 'Cherokee', 'Khmer', 'Mongolian', 'Thaana', 'Syriac', 'Bopomofo', 'Coptic',
  'Runic', 'Ogham', 'Braille', 'Canadian_Aboriginal', 'Adlam', 'Nko', 'Vai', 'Yi', 'Tifinagh',
  'Osage', 'Deseret', 'Gothic', 'Old_Italic', 'Linear_B', 'Cuneiform', 'Egyptian_Hieroglyphs',
  'Balinese', 'Javanese', 'Cham', 'Limbu', 'Tagalog', 'Buginese', 'Lepcha', 'Sundanese',
  'Glagolitic', 'Shavian', 'Lisu', 'Bamum', 'Meetei_Mayek', 'Samaritan', 'Mandaic',
  'Cypriot', 'Phags_Pa',
  'Common', 'Inherited', 'Unknown',
]

/** Unicode block ranges: [start, end, name], ascending and non-overlapping. */
const BLOCKS: Array<[number, number, string]> = [
  [0x0000, 0x007f, 'Basic Latin'],
  [0x0080, 0x00ff, 'Latin-1 Supplement'],
  [0x0100, 0x017f, 'Latin Extended-A'],
  [0x0180, 0x024f, 'Latin Extended-B'],
  [0x0250, 0x02af, 'IPA Extensions'],
  [0x02b0, 0x02ff, 'Spacing Modifier Letters'],
  [0x0300, 0x036f, 'Combining Diacritical Marks'],
  [0x0370, 0x03ff, 'Greek and Coptic'],
  [0x0400, 0x04ff, 'Cyrillic'],
  [0x0500, 0x052f, 'Cyrillic Supplement'],
  [0x0530, 0x058f, 'Armenian'],
  [0x0590, 0x05ff, 'Hebrew'],
  [0x0600, 0x06ff, 'Arabic'],
  [0x0700, 0x074f, 'Syriac'],
  [0x0750, 0x077f, 'Arabic Supplement'],
  [0x0780, 0x07bf, 'Thaana'],
  [0x07c0, 0x07ff, 'NKo'],
  [0x0800, 0x083f, 'Samaritan'],
  [0x0840, 0x085f, 'Mandaic'],
  [0x0860, 0x086f, 'Syriac Supplement'],
  [0x0870, 0x089f, 'Arabic Extended-B'],
  [0x08a0, 0x08ff, 'Arabic Extended-A'],
  [0x0900, 0x097f, 'Devanagari'],
  [0x0980, 0x09ff, 'Bengali'],
  [0x0a00, 0x0a7f, 'Gurmukhi'],
  [0x0a80, 0x0aff, 'Gujarati'],
  [0x0b00, 0x0b7f, 'Oriya'],
  [0x0b80, 0x0bff, 'Tamil'],
  [0x0c00, 0x0c7f, 'Telugu'],
  [0x0c80, 0x0cff, 'Kannada'],
  [0x0d00, 0x0d7f, 'Malayalam'],
  [0x0d80, 0x0dff, 'Sinhala'],
  [0x0e00, 0x0e7f, 'Thai'],
  [0x0e80, 0x0eff, 'Lao'],
  [0x0f00, 0x0fff, 'Tibetan'],
  [0x1000, 0x109f, 'Myanmar'],
  [0x10a0, 0x10ff, 'Georgian'],
  [0x1100, 0x11ff, 'Hangul Jamo'],
  [0x1200, 0x137f, 'Ethiopic'],
  [0x1380, 0x139f, 'Ethiopic Supplement'],
  [0x13a0, 0x13ff, 'Cherokee'],
  [0x1400, 0x167f, 'Unified Canadian Aboriginal Syllabics'],
  [0x1680, 0x169f, 'Ogham'],
  [0x16a0, 0x16ff, 'Runic'],
  [0x1700, 0x171f, 'Tagalog'],
  [0x1720, 0x173f, 'Hanunoo'],
  [0x1740, 0x175f, 'Buhid'],
  [0x1760, 0x177f, 'Tagbanwa'],
  [0x1780, 0x17ff, 'Khmer'],
  [0x1800, 0x18af, 'Mongolian'],
  [0x18b0, 0x18ff, 'Unified Canadian Aboriginal Syllabics Extended'],
  [0x1900, 0x194f, 'Limbu'],
  [0x1950, 0x197f, 'Tai Le'],
  [0x1980, 0x19df, 'New Tai Lue'],
  [0x19e0, 0x19ff, 'Khmer Symbols'],
  [0x1a00, 0x1a1f, 'Buginese'],
  [0x1a20, 0x1aaf, 'Tai Tham'],
  [0x1ab0, 0x1aff, 'Combining Diacritical Marks Extended'],
  [0x1b00, 0x1b7f, 'Balinese'],
  [0x1b80, 0x1bbf, 'Sundanese'],
  [0x1bc0, 0x1bff, 'Batak'],
  [0x1c00, 0x1c4f, 'Lepcha'],
  [0x1c50, 0x1c7f, 'Ol Chiki'],
  [0x1c80, 0x1c8f, 'Cyrillic Extended-C'],
  [0x1c90, 0x1cbf, 'Georgian Extended'],
  [0x1cc0, 0x1ccf, 'Sundanese Supplement'],
  [0x1cd0, 0x1cff, 'Vedic Extensions'],
  [0x1d00, 0x1d7f, 'Phonetic Extensions'],
  [0x1d80, 0x1dbf, 'Phonetic Extensions Supplement'],
  [0x1dc0, 0x1dff, 'Combining Diacritical Marks Supplement'],
  [0x1e00, 0x1eff, 'Latin Extended Additional'],
  [0x1f00, 0x1fff, 'Greek Extended'],
  [0x2000, 0x206f, 'General Punctuation'],
  [0x2070, 0x209f, 'Superscripts and Subscripts'],
  [0x20a0, 0x20cf, 'Currency Symbols'],
  [0x20d0, 0x20ff, 'Combining Diacritical Marks for Symbols'],
  [0x2100, 0x214f, 'Letterlike Symbols'],
  [0x2150, 0x218f, 'Number Forms'],
  [0x2190, 0x21ff, 'Arrows'],
  [0x2200, 0x22ff, 'Mathematical Operators'],
  [0x2300, 0x23ff, 'Miscellaneous Technical'],
  [0x2400, 0x243f, 'Control Pictures'],
  [0x2440, 0x245f, 'Optical Character Recognition'],
  [0x2460, 0x24ff, 'Enclosed Alphanumerics'],
  [0x2500, 0x257f, 'Box Drawing'],
  [0x2580, 0x259f, 'Block Elements'],
  [0x25a0, 0x25ff, 'Geometric Shapes'],
  [0x2600, 0x26ff, 'Miscellaneous Symbols'],
  [0x2700, 0x27bf, 'Dingbats'],
  [0x27c0, 0x27ef, 'Miscellaneous Mathematical Symbols-A'],
  [0x27f0, 0x27ff, 'Supplemental Arrows-A'],
  [0x2800, 0x28ff, 'Braille Patterns'],
  [0x2900, 0x297f, 'Supplemental Arrows-B'],
  [0x2980, 0x29ff, 'Miscellaneous Mathematical Symbols-B'],
  [0x2a00, 0x2aff, 'Supplemental Mathematical Operators'],
  [0x2b00, 0x2bff, 'Miscellaneous Symbols and Arrows'],
  [0x2c00, 0x2c5f, 'Glagolitic'],
  [0x2c60, 0x2c7f, 'Latin Extended-C'],
  [0x2c80, 0x2cff, 'Coptic'],
  [0x2d00, 0x2d2f, 'Georgian Supplement'],
  [0x2d30, 0x2d7f, 'Tifinagh'],
  [0x2d80, 0x2ddf, 'Ethiopic Extended'],
  [0x2de0, 0x2dff, 'Cyrillic Extended-A'],
  [0x2e00, 0x2e7f, 'Supplemental Punctuation'],
  [0x2e80, 0x2eff, 'CJK Radicals Supplement'],
  [0x2f00, 0x2fdf, 'Kangxi Radicals'],
  [0x2ff0, 0x2fff, 'Ideographic Description Characters'],
  [0x3000, 0x303f, 'CJK Symbols and Punctuation'],
  [0x3040, 0x309f, 'Hiragana'],
  [0x30a0, 0x30ff, 'Katakana'],
  [0x3100, 0x312f, 'Bopomofo'],
  [0x3130, 0x318f, 'Hangul Compatibility Jamo'],
  [0x3190, 0x319f, 'Kanbun'],
  [0x31a0, 0x31bf, 'Bopomofo Extended'],
  [0x31c0, 0x31ef, 'CJK Strokes'],
  [0x31f0, 0x31ff, 'Katakana Phonetic Extensions'],
  [0x3200, 0x32ff, 'Enclosed CJK Letters and Months'],
  [0x3300, 0x33ff, 'CJK Compatibility'],
  [0x3400, 0x4dbf, 'CJK Unified Ideographs Extension A'],
  [0x4dc0, 0x4dff, 'Yijing Hexagram Symbols'],
  [0x4e00, 0x9fff, 'CJK Unified Ideographs'],
  [0xa000, 0xa48f, 'Yi Syllables'],
  [0xa490, 0xa4cf, 'Yi Radicals'],
  [0xa4d0, 0xa4ff, 'Lisu'],
  [0xa500, 0xa63f, 'Vai'],
  [0xa640, 0xa69f, 'Cyrillic Extended-B'],
  [0xa6a0, 0xa6ff, 'Bamum'],
  [0xa700, 0xa71f, 'Modifier Tone Letters'],
  [0xa720, 0xa7ff, 'Latin Extended-D'],
  [0xa800, 0xa82f, 'Syloti Nagri'],
  [0xa830, 0xa83f, 'Common Indic Number Forms'],
  [0xa840, 0xa87f, 'Phags-pa'],
  [0xa880, 0xa8df, 'Saurashtra'],
  [0xa8e0, 0xa8ff, 'Devanagari Extended'],
  [0xa900, 0xa92f, 'Kayah Li'],
  [0xa930, 0xa95f, 'Rejang'],
  [0xa960, 0xa97f, 'Hangul Jamo Extended-A'],
  [0xa980, 0xa9df, 'Javanese'],
  [0xa9e0, 0xa9ff, 'Myanmar Extended-B'],
  [0xaa00, 0xaa5f, 'Cham'],
  [0xaa60, 0xaa7f, 'Myanmar Extended-A'],
  [0xaa80, 0xaadf, 'Tai Viet'],
  [0xaae0, 0xaaff, 'Meetei Mayek Extensions'],
  [0xab00, 0xab2f, 'Ethiopic Extended-A'],
  [0xab30, 0xab6f, 'Latin Extended-E'],
  [0xab70, 0xabbf, 'Cherokee Supplement'],
  [0xabc0, 0xabff, 'Meetei Mayek'],
  [0xac00, 0xd7af, 'Hangul Syllables'],
  [0xd7b0, 0xd7ff, 'Hangul Jamo Extended-B'],
  [0xd800, 0xdb7f, 'High Surrogates'],
  [0xdb80, 0xdbff, 'High Private Use Surrogates'],
  [0xdc00, 0xdfff, 'Low Surrogates'],
  [0xe000, 0xf8ff, 'Private Use Area'],
  [0xf900, 0xfaff, 'CJK Compatibility Ideographs'],
  [0xfb00, 0xfb4f, 'Alphabetic Presentation Forms'],
  [0xfb50, 0xfdff, 'Arabic Presentation Forms-A'],
  [0xfe00, 0xfe0f, 'Variation Selectors'],
  [0xfe10, 0xfe1f, 'Vertical Forms'],
  [0xfe20, 0xfe2f, 'Combining Half Marks'],
  [0xfe30, 0xfe4f, 'CJK Compatibility Forms'],
  [0xfe50, 0xfe6f, 'Small Form Variants'],
  [0xfe70, 0xfeff, 'Arabic Presentation Forms-B'],
  [0xff00, 0xffef, 'Halfwidth and Fullwidth Forms'],
  [0xfff0, 0xffff, 'Specials'],
  [0x10000, 0x1007f, 'Linear B Syllabary'],
  [0x10080, 0x100ff, 'Linear B Ideograms'],
  [0x10100, 0x1013f, 'Aegean Numbers'],
  [0x10140, 0x1018f, 'Ancient Greek Numbers'],
  [0x10190, 0x101cf, 'Ancient Symbols'],
  [0x10300, 0x1032f, 'Old Italic'],
  [0x10330, 0x1034f, 'Gothic'],
  [0x10400, 0x1044f, 'Deseret'],
  [0x10450, 0x1047f, 'Shavian'],
  [0x10480, 0x104af, 'Osmanya'],
  [0x104b0, 0x104ff, 'Osage'],
  [0x10800, 0x1083f, 'Cypriot Syllabary'],
  [0x10900, 0x1091f, 'Phoenician'],
  [0x11000, 0x1107f, 'Brahmi'],
  [0x11080, 0x110cf, 'Kaithi'],
  [0x11100, 0x1114f, 'Chakma'],
  [0x12000, 0x123ff, 'Cuneiform'],
  [0x13000, 0x1342f, 'Egyptian Hieroglyphs'],
  [0x16800, 0x16a3f, 'Bamum Supplement'],
  [0x1d000, 0x1d0ff, 'Byzantine Musical Symbols'],
  [0x1d100, 0x1d1ff, 'Musical Symbols'],
  [0x1d200, 0x1d24f, 'Ancient Greek Musical Notation'],
  [0x1d300, 0x1d35f, 'Tai Xuan Jing Symbols'],
  [0x1d360, 0x1d37f, 'Counting Rod Numerals'],
  [0x1d400, 0x1d7ff, 'Mathematical Alphanumeric Symbols'],
  [0x1e900, 0x1e95f, 'Adlam'],
  [0x1f000, 0x1f02f, 'Mahjong Tiles'],
  [0x1f030, 0x1f09f, 'Domino Tiles'],
  [0x1f0a0, 0x1f0ff, 'Playing Cards'],
  [0x1f100, 0x1f1ff, 'Enclosed Alphanumeric Supplement'],
  [0x1f200, 0x1f2ff, 'Enclosed Ideographic Supplement'],
  [0x1f300, 0x1f5ff, 'Miscellaneous Symbols and Pictographs'],
  [0x1f600, 0x1f64f, 'Emoticons'],
  [0x1f650, 0x1f67f, 'Ornamental Dingbats'],
  [0x1f680, 0x1f6ff, 'Transport and Map Symbols'],
  [0x1f700, 0x1f77f, 'Alchemical Symbols'],
  [0x1f780, 0x1f7ff, 'Geometric Shapes Extended'],
  [0x1f800, 0x1f8ff, 'Supplemental Arrows-C'],
  [0x1f900, 0x1f9ff, 'Supplemental Symbols and Pictographs'],
  [0x1fa00, 0x1fa6f, 'Chess Symbols'],
  [0x1fa70, 0x1faff, 'Symbols and Pictographs Extended-A'],
  [0x1fb00, 0x1fbff, 'Symbols for Legacy Computing'],
  [0x20000, 0x2a6df, 'CJK Unified Ideographs Extension B'],
  [0x2a700, 0x2b73f, 'CJK Unified Ideographs Extension C'],
  [0x2b740, 0x2b81f, 'CJK Unified Ideographs Extension D'],
  [0x2b820, 0x2ceaf, 'CJK Unified Ideographs Extension E'],
  [0x2ceb0, 0x2ebef, 'CJK Unified Ideographs Extension F'],
  [0x2f800, 0x2fa1f, 'CJK Compatibility Ideographs Supplement'],
  [0xe0000, 0xe007f, 'Tags'],
  [0xe0100, 0xe01ef, 'Variation Selectors Supplement'],
  [0xf0000, 0xffffd, 'Supplementary Private Use Area-A'],
  [0x100000, 0x10fffd, 'Supplementary Private Use Area-B'],
]

const CONTROL_LABELS: Record<number, string> = {
  0x00: '\\0',
  0x07: '\\a',
  0x08: '\\b',
  0x09: '\\t',
  0x0a: '\\n',
  0x0b: '\\v',
  0x0c: '\\f',
  0x0d: '\\r',
  0x1b: '\\e',
}

/** Compile `\p{...}` matchers once, skipping any value this engine does not know. */
function buildMatchers(property: string, values: string[]): Array<[string, RegExp]> {
  const out: Array<[string, RegExp]> = []
  for (const value of values) {
    try {
      out.push([value, new RegExp(`^\\p{${property}=${value}}$`, 'u')])
    } catch {
      /* engine does not know this property value — skip it */
    }
  }
  return out
}

let categoryMatchers: Array<[string, RegExp]> | null = null
let scriptMatchers: Array<[string, RegExp]> | null = null
let pictographic: RegExp | null | undefined
const categoryCache = new Map<number, string>()
const scriptCache = new Map<number, string>()

function categoryOf(ch: string, cp: number): string {
  const cached = categoryCache.get(cp)
  if (cached) return cached
  if (!categoryMatchers) categoryMatchers = buildMatchers('General_Category', Object.keys(CATEGORY_NAMES))
  let found = 'Cn'
  for (const [code, re] of categoryMatchers) {
    if (re.test(ch)) {
      found = code
      break
    }
  }
  categoryCache.set(cp, found)
  return found
}

/**
 * A block and its script usually share a name (`Tai Le`, `Ol Chiki`, `Chakma`…), so when the
 * fixed list above has no entry we ask the engine whether the block name is also a script name.
 * The candidate is reduced to `[A-Za-z0-9_]` first, so nothing regex-significant reaches `RegExp`.
 */
function scriptFromBlockName(ch: string, block: string): string | null {
  const candidate = block.trim().replace(/[^A-Za-z0-9]+/g, '_')
  if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(candidate)) return null
  try {
    if (new RegExp(`^\\p{Script=${candidate}}$`, 'u').test(ch)) return candidate
  } catch {
    /* the block name is not a script name this engine knows */
  }
  return null
}

function scriptOf(ch: string, cp: number): string {
  const cached = scriptCache.get(cp)
  if (cached) return cached
  if (!scriptMatchers) scriptMatchers = buildMatchers('Script', SCRIPT_NAMES)
  let found = ''
  for (const [name, re] of scriptMatchers) {
    if (re.test(ch)) {
      found = name
      break
    }
  }
  if (!found) found = scriptFromBlockName(ch, blockOf(cp)) ?? 'Unknown'
  const pretty = found.replace(/_/g, ' ')
  scriptCache.set(cp, pretty)
  return pretty
}

function blockOf(cp: number): string {
  for (const [start, end, name] of BLOCKS) {
    if (cp < start) break
    if (cp <= end) return name
  }
  return 'Unassigned'
}

function isEmojiCodePoint(ch: string, cp: number): boolean {
  if (cp >= 0x1f1e6 && cp <= 0x1f1ff) return true // regional indicators
  if (pictographic === undefined) {
    try {
      pictographic = new RegExp('^\\p{Extended_Pictographic}$', 'u')
    } catch {
      pictographic = null
    }
  }
  return pictographic ? pictographic.test(ch) : false
}

function toHex(n: number, pad: number): string {
  return n.toString(16).toUpperCase().padStart(pad, '0')
}

function utf8Hex(ch: string): string {
  return Array.from(encoder.encode(ch))
    .map((b) => toHex(b, 2))
    .join(' ')
}

function utf16Hex(ch: string): string {
  const units: string[] = []
  for (let i = 0; i < ch.length; i++) units.push(toHex(ch.charCodeAt(i), 4))
  return units.join(' ')
}

export function inspectCodePoint(ch: string, index: number): Row {
  const cp = ch.codePointAt(0) ?? 0
  const category = categoryOf(ch, cp)
  return {
    index,
    char: ch,
    codePoint: `U+${toHex(cp, 4)}`,
    decimal: cp,
    utf8: utf8Hex(ch),
    utf16: utf16Hex(ch),
    category,
    categoryName: CATEGORY_NAMES[category] ?? 'Unknown',
    script: scriptOf(ch, cp),
    block: blockOf(cp),
    isCombining: category === 'Mn' || category === 'Mc' || category === 'Me',
    isEmoji: isEmojiCodePoint(ch, cp),
  }
}

/** A printable stand-in for characters that would corrupt or vanish from the table. */
function displayChar(row: Row): string {
  const cp = row.decimal
  if (CONTROL_LABELS[cp]) return CONTROL_LABELS[cp]
  if (cp === 0x20) return 'SP'
  if (/^[CZ]/.test(row.category)) return `<${row.codePoint.slice(2)}>`
  if (row.isCombining) return `◌${row.char}`
  return row.char
}

function flagsOf(row: Row): string {
  const flags: string[] = []
  if (row.isCombining) flags.push('combining')
  if (row.isEmoji) flags.push('emoji')
  return flags.join('+')
}

function renderTable(rows: Row[], total: number): string {
  if (!rows.length) return ''
  const headers = [
    '#', 'CHAR', 'CODE POINT', 'DEC', 'UTF-8', 'UTF-16', 'GC', 'CATEGORY', 'SCRIPT', 'BLOCK', 'FLAGS',
  ]
  const body = rows.map((r) => [
    String(r.index),
    displayChar(r),
    r.codePoint,
    String(r.decimal),
    r.utf8,
    r.utf16,
    r.category,
    r.categoryName,
    r.script,
    r.block,
    flagsOf(r),
  ])
  const widths = headers.map((h, i) =>
    body.reduce((w, cells) => Math.max(w, cells[i].length), h.length)
  )
  const line = (cells: string[]) =>
    cells.map((c, i) => (i === cells.length - 1 ? c : c.padEnd(widths[i]))).join('  ').replace(/\s+$/, '')
  const out = [line(headers), ...body.map(line)]
  const hidden = total - rows.length
  if (hidden > 0) {
    out.push(`… ${hidden} more code point${hidden === 1 ? '' : 's'} not shown (limit ${rows.length})`)
  }
  return out.join('\n')
}

const util: Utility = {
  id: 'unicode_inspect',
  name: 'unicode inspect',
  category: 'Analysis',
  description:
    'Break text into code points and report U+ value, decimal, UTF-8 and UTF-16 bytes, general category, script, block, combining and emoji flags — as an aligned table or JSON, capped by limit (0 = no cap).',
  accepts: 'string',
  produces: ['string', 'json'],
  tags: ['code point inspector', 'utf-8 bytes', 'utf-16', 'character info', 'unicode debugger', 'grapheme inspector'],
  params: {
    limit: { kind: 'number', label: 'limit (0 = all)', default: 200, min: 0, integer: true, max: 100000 },
    format: { kind: 'select', label: 'format', options: ['table', 'json'], default: 'table' },
  },
  examples: [
    {
      title: 'letters, an accent and an emoji',
      input: 'Aé😀',
      params: { limit: 5 },
      output:
        '#  CHAR  CODE POINT  DEC     UTF-8        UTF-16     GC  CATEGORY          SCRIPT  BLOCK               FLAGS\n' +
        '0  A     U+0041      65      41           0041       Lu  Uppercase Letter  Latin   Basic Latin\n' +
        '1  é     U+00E9      233     C3 A9        00E9       Ll  Lowercase Letter  Latin   Latin-1 Supplement\n' +
        '2  😀    U+1F600     128512  F0 9F 98 80  D83D DE00  So  Other Symbol      Common  Emoticons           emoji'
    }
  ],
  apply: (input: any, params: any): any => {
    const format = params?.format ?? 'table'
    if (format !== 'table' && format !== 'json') {
      throw new Error(`unknown format: ${String(format)} (expected table or json)`)
    }
    const rawLimit = Number(params?.limit ?? 200)
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.floor(rawLimit) : 0

    const s = typeof input === 'string' ? input : String(input ?? '')
    const points = Array.from(s)
    const total = points.length
    const shown = limit > 0 ? Math.min(limit, total) : total
    const rows: Row[] = []
    for (let i = 0; i < shown; i++) rows.push(inspectCodePoint(points[i], i))

    if (format === 'json') {
      return { total, shown, truncated: shown < total, codePoints: rows }
    }
    return renderTable(rows, total)
  },
}

export default util
