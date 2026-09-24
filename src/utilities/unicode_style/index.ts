import type { Utility } from '@/types/utility'

/**
 * Styles text by mapping ASCII letters/digits onto Unicode look-alike ranges
 * (mathematical alphanumerics, circled letters, fullwidth forms, ...) or by
 * decorating each code point with combining marks.
 *
 * Everything iterates code points, so astral characters (emoji) pass through
 * whole instead of being split into surrogate halves. Every non-ASCII literal
 * below is written as an escape on purpose — these tables are unreadable as raw
 * glyphs and a stray look-alike would be impossible to spot.
 */

export const STYLES = [
  'fullwidth', 'small-caps', 'bubble', 'bubble-filled', 'square', 'upside-down',
  'bold', 'italic', 'bold-italic', 'monospace', 'script', 'fraktur',
  'double-struck', 'strikethrough', 'underline', 'superscript', 'subscript', 'zalgo'
]

/** ceiling on zalgo intensity so a fat-fingered number cannot hang the tab */
const MAX_INTENSITY = 200

const UP_A = 0x41
const UP_Z = 0x5a
const LO_A = 0x61
const LO_Z = 0x7a
const D0 = 0x30
const D9 = 0x39

type Styler = (ch: string) => string

type RangeOpts = {
  upper?: number
  lower?: number
  digit?: number
  /** upper-case lowercase letters first (ranges that only define capitals) */
  foldToUpper?: boolean
  /** per-character exceptions for reserved/holed code points */
  holes?: Record<string, string>
}

const rangeStyle = (opts: RangeOpts): Styler => {
  const holes = opts.holes ? new Map(Object.entries(opts.holes)) : null
  return (ch: string) => {
    if (holes) {
      const hole = holes.get(ch)
      if (hole !== undefined) return hole
    }
    let cp = ch.codePointAt(0) as number
    if (opts.foldToUpper && cp >= LO_A && cp <= LO_Z) cp -= 32
    if (opts.upper !== undefined && cp >= UP_A && cp <= UP_Z) {
      return String.fromCodePoint(opts.upper + (cp - UP_A))
    }
    if (opts.lower !== undefined && cp >= LO_A && cp <= LO_Z) {
      return String.fromCodePoint(opts.lower + (cp - LO_A))
    }
    if (opts.digit !== undefined && cp >= D0 && cp <= D9) {
      return String.fromCodePoint(opts.digit + (cp - D0))
    }
    return ch
  }
}

const tableStyle = (table: Record<string, string>, foldToLower = false): Styler => {
  const map = new Map(Object.entries(table))
  return (ch: string) => {
    const direct = map.get(ch)
    if (direct !== undefined) return direct
    if (foldToLower) {
      const folded = map.get(ch.toLowerCase())
      if (folded !== undefined) return folded
    }
    return ch
  }
}

const combining = (mark: string): Styler => (ch: string) =>
  ch === '\n' || ch === '\r' ? ch : ch + mark

const SMALL_CAPS: Record<string, string> = {
  a: 'ᴀ', b: 'ʙ', c: 'ᴄ', d: 'ᴅ', e: 'ᴇ', f: 'ꜰ',
  g: 'ɢ', h: 'ʜ', i: 'ɪ', j: 'ᴊ', k: 'ᴋ', l: 'ʟ',
  m: 'ᴍ', n: 'ɴ', o: 'ᴏ', p: 'ᴘ', q: 'ǫ', r: 'ʀ',
  s: 'ꜱ', t: 'ᴛ', u: 'ᴜ', v: 'ᴠ', w: 'ᴡ', x: 'x',
  y: 'ʏ', z: 'ᴢ'
}

const SUPERSCRIPT: Record<string, string> = {
  a: 'ᵃ', b: 'ᵇ', c: 'ᶜ', d: 'ᵈ', e: 'ᵉ', f: 'ᶠ',
  g: 'ᵍ', h: 'ʰ', i: 'ⁱ', j: 'ʲ', k: 'ᵏ', l: 'ˡ',
  m: 'ᵐ', n: 'ⁿ', o: 'ᵒ', p: 'ᵖ', q: 'q', r: 'ʳ',
  s: 'ˢ', t: 'ᵗ', u: 'ᵘ', v: 'ᵛ', w: 'ʷ', x: 'ˣ',
  y: 'ʸ', z: 'ᶻ',
  A: 'ᴬ', B: 'ᴮ', D: 'ᴰ', E: 'ᴱ', G: 'ᴳ', H: 'ᴴ',
  I: 'ᴵ', J: 'ᴶ', K: 'ᴷ', L: 'ᴸ', M: 'ᴹ', N: 'ᴺ',
  O: 'ᴼ', P: 'ᴾ', R: 'ᴿ', T: 'ᵀ', U: 'ᵁ', V: 'ⱽ',
  W: 'ᵂ',
  '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
  '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
  '+': '⁺', '-': '⁻', '=': '⁼', '(': '⁽', ')': '⁾'
}

const SUBSCRIPT: Record<string, string> = {
  a: 'ₐ', e: 'ₑ', h: 'ₕ', i: 'ᵢ', j: 'ⱼ', k: 'ₖ',
  l: 'ₗ', m: 'ₘ', n: 'ₙ', o: 'ₒ', p: 'ₚ', r: 'ᵣ',
  s: 'ₛ', t: 'ₜ', u: 'ᵤ', v: 'ᵥ', x: 'ₓ',
  '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄',
  '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉',
  '+': '₊', '-': '₋', '=': '₌', '(': '₍', ')': '₎'
}

const UPSIDE_DOWN: Record<string, string> = {
  a: 'ɐ', b: 'q', c: 'ɔ', d: 'p', e: 'ǝ', f: 'ɟ',
  g: 'ƃ', h: 'ɥ', i: 'ᴉ', j: 'ɾ', k: 'ʞ', l: 'l',
  m: 'ɯ', n: 'u', o: 'o', p: 'd', q: 'b', r: 'ɹ', s: 's',
  t: 'ʇ', u: 'n', v: 'ʌ', w: 'ʍ', x: 'x', y: 'ʎ', z: 'z',
  A: '∀', B: 'ᗺ', C: 'Ɔ', D: 'ᗡ', E: 'Ǝ', F: 'Ⅎ',
  G: '⅁', H: 'H', I: 'I', J: 'ſ', K: 'ʞ', L: '˥', M: 'W',
  N: 'N', O: 'O', P: 'Ԁ', Q: 'Ò', R: 'ᴚ', S: 'S', T: '⊥',
  U: '∩', V: 'Λ', W: 'M', X: 'X', Y: '⅄', Z: 'Z',
  '0': '0', '1': 'Ɩ', '2': 'ᄅ', '3': 'Ɛ', '4': 'ㄣ',
  '5': 'ϛ', '6': '9', '7': 'ㄥ', '8': '8', '9': '6',
  '.': '˙', ',': '‘', "'": ',', '"': '„', '`': ',',
  '?': '¿', '!': '¡', '[': ']', ']': '[', '(': ')', ')': '(',
  '{': '}', '}': '{', '<': '>', '>': '<', '&': '⅋', '_': '‾',
  ';': '؛', '∴': '∵'
}

const fullwidth: Styler = (ch: string) => {
  const cp = ch.codePointAt(0) as number
  if (cp === 0x20) return '　'
  if (cp >= 0x21 && cp <= 0x7e) return String.fromCodePoint(0xff01 + (cp - 0x21))
  return ch
}

const bubble: Styler = (ch: string) => {
  const cp = ch.codePointAt(0) as number
  if (cp === D0) return '⓪'
  if (cp > D0 && cp <= D9) return String.fromCodePoint(0x2460 + (cp - D0 - 1))
  if (cp >= UP_A && cp <= UP_Z) return String.fromCodePoint(0x24B6 + (cp - UP_A))
  if (cp >= LO_A && cp <= LO_Z) return String.fromCodePoint(0x24D0 + (cp - LO_A))
  return ch
}

const bubbleFilled: Styler = (ch: string) => {
  let cp = ch.codePointAt(0) as number
  if (cp === D0) return '⓿'
  if (cp > D0 && cp <= D9) return String.fromCodePoint(0x278A + (cp - D0 - 1))
  if (cp >= LO_A && cp <= LO_Z) cp -= 32
  if (cp >= UP_A && cp <= UP_Z) return String.fromCodePoint(0x1F150 + (cp - UP_A))
  return ch
}

/** combining marks, written as code points so no stray glyph can creep in */
const marks = (...cps: number[]) => cps.map((cp) => String.fromCodePoint(cp))

const ZALGO_UP = marks(
  0x030d, 0x030e, 0x0304, 0x0305, 0x033f, 0x0311, 0x0306, 0x0310,
  0x0352, 0x0357, 0x0351, 0x0307, 0x0308, 0x030a, 0x0342, 0x0343,
  0x0344, 0x034a, 0x034b, 0x034c, 0x0303, 0x0302, 0x030c, 0x0350,
  0x0300, 0x0301, 0x030b, 0x030f, 0x0312, 0x0313, 0x0314, 0x033d,
  0x0309, 0x0363, 0x0364, 0x0365, 0x0366, 0x0367, 0x0368, 0x0369
)
const ZALGO_MID = marks(
  0x0315, 0x031b, 0x0358, 0x0321, 0x0322, 0x0327, 0x0328, 0x0334,
  0x0335, 0x0336, 0x034f, 0x035c, 0x035d, 0x035e
)
const ZALGO_DOWN = marks(
  0x0316, 0x0317, 0x0318, 0x0319, 0x031c, 0x031d, 0x031e, 0x031f,
  0x0320, 0x0324, 0x0325, 0x0326, 0x0329, 0x032a, 0x032b, 0x032c,
  0x032d, 0x032e, 0x032f, 0x0330, 0x0331, 0x0332, 0x0333, 0x0339,
  0x033a, 0x033b, 0x033c, 0x0345, 0x0347, 0x0348, 0x0349, 0x034d,
  0x034e, 0x0353, 0x0354, 0x0355, 0x0356, 0x0359, 0x035a, 0x0323
)

/** deterministic PRNG — the pipeline re-runs on every keystroke, so no Math.random */
const mulberry32 = (seed: number) => {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** FNV-1a over code points, used when seed is 0 so output still varies per input */
const seedFromText = (s: string) => {
  let h = 0x811c9dc5
  for (const ch of s) {
    h ^= ch.codePointAt(0) as number
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0) || 0x9e3779b9
}

const zalgo = (s: string, intensity: number, seed: number): string => {
  if (intensity <= 0) return s
  const rand = mulberry32(seed !== 0 ? seed : seedFromText(s))
  const pick = (pool: string[]) => pool[Math.floor(rand() * pool.length)]
  let out = ''
  for (const ch of s) {
    out += ch
    if (/\s/.test(ch)) continue
    const up = 1 + Math.floor(rand() * intensity)
    const mid = Math.floor(rand() * (intensity / 2 + 1))
    const down = 1 + Math.floor(rand() * intensity)
    for (let i = 0; i < up; i++) out += pick(ZALGO_UP)
    for (let i = 0; i < mid; i++) out += pick(ZALGO_MID)
    for (let i = 0; i < down; i++) out += pick(ZALGO_DOWN)
  }
  return out
}

const STYLERS: Record<string, Styler> = {
  fullwidth,
  // capitals fold into the small-cap forms too: a style that silently no-ops
  // on ALL-CAPS input reads as broken
  'small-caps': tableStyle(SMALL_CAPS, true),
  bubble,
  'bubble-filled': bubbleFilled,
  square: rangeStyle({ upper: 0x1f130, foldToUpper: true }),
  'upside-down': tableStyle(UPSIDE_DOWN),
  bold: rangeStyle({ upper: 0x1d400, lower: 0x1d41a, digit: 0x1d7ce }),
  italic: rangeStyle({ upper: 0x1d434, lower: 0x1d44e, holes: { h: 'ℎ' } }),
  'bold-italic': rangeStyle({ upper: 0x1d468, lower: 0x1d482 }),
  monospace: rangeStyle({ upper: 0x1d670, lower: 0x1d68a, digit: 0x1d7f6 }),
  script: rangeStyle({
    upper: 0x1d49c,
    lower: 0x1d4b6,
    holes: {
      B: 'ℬ', E: 'ℰ', F: 'ℱ', H: 'ℋ', I: 'ℐ',
      L: 'ℒ', M: 'ℳ', R: 'ℛ',
      e: 'ℯ', g: 'ℊ', o: 'ℴ'
    }
  }),
  fraktur: rangeStyle({
    upper: 0x1d504,
    lower: 0x1d51e,
    holes: { C: 'ℭ', H: 'ℌ', I: 'ℑ', R: 'ℜ', Z: 'ℨ' }
  }),
  'double-struck': rangeStyle({
    upper: 0x1d538,
    lower: 0x1d552,
    digit: 0x1d7d8,
    holes: {
      C: 'ℂ', H: 'ℍ', N: 'ℕ', P: 'ℙ',
      Q: 'ℚ', R: 'ℝ', Z: 'ℤ'
    }
  }),
  strikethrough: combining('̶'),
  underline: combining('̲'),
  superscript: tableStyle(SUPERSCRIPT, true),
  subscript: tableStyle(SUBSCRIPT, true)
}

const util: Utility = {
  id: 'unicode_style',
  name: 'unicode text style',
  category: 'Formatting',
  description:
    'Restyle text with Unicode look-alikes such as fullwidth, bold, italic, script, fraktur, bubble, upside-down, or zalgo.',
  accepts: 'string',
  produces: 'string',
  tags: ['fancy text', 'font', 'unicode', 'stylize', 'aesthetic', 'symbols', 'zalgo', 'cursed text', 'bold text', 'small caps'],
  aliases: ['fancy font generator', 'sparkle text'],
  examples: [
    {
      title: 'bold',
      input: 'Hello',
      params: { style: 'bold' },
      output: '𝐇𝐞𝐥𝐥𝐨'
    },
    {
      title: 'small caps',
      input: 'Hello World',
      params: { style: 'small-caps' },
      output: 'ʜᴇʟʟᴏ ᴡᴏʀʟᴅ'
    },
    {
      title: 'zalgo, seeded for reproducible output',
      input: 'cursed',
      params: { style: 'zalgo', intensity: 5, seed: 42 },
      outputMatches: '^c[\\s\\S]+d[\\s\\S]*$'
    }
  ],
  params: {
    style: {
      kind: 'select',
      label: 'style',
      options: STYLES,
      default: 'fullwidth'
    },
    intensity: { kind: 'range', label: 'zalgo intensity', default: 3, min: 0, max: MAX_INTENSITY, step: 1 },
    seed: { kind: 'number', label: 'zalgo seed (0 = derive from text)', default: 0 }
  },
  apply: (input: any, params: any) => {
    const s = String(input ?? '')
    const style = params?.style ?? 'fullwidth'
    if (!STYLES.includes(style)) {
      throw new Error(`unknown style: ${style} (expected one of ${STYLES.join(', ')})`)
    }
    const intensity = Number(params?.intensity ?? 3)
    if (!Number.isFinite(intensity)) throw new Error('intensity must be a number')
    if (intensity < 0) throw new Error('intensity must be 0 or greater')
    // each unit of intensity is up to two more combining marks per character,
    // and the pipeline re-runs on every keystroke
    if (intensity > MAX_INTENSITY) throw new Error(`intensity must be ${MAX_INTENSITY} or less`)
    const seed = Number(params?.seed ?? 0)
    if (!Number.isFinite(seed)) throw new Error('seed must be a number')
    if (!s) return ''

    if (style === 'zalgo') return zalgo(s, Math.floor(intensity), Math.trunc(seed))

    const styler = STYLERS[style]
    if (style === 'upside-down') {
      // upside-down also mirrors the reading order: every line is reversed and
      // the lines themselves swap top for bottom. Reversing the whole string in
      // one go would flip the code units of a CRLF into LF CR, so work per line.
      return s
        .split(/\r\n|\r|\n/)
        .map((line) => Array.from(line).map(styler).reverse().join(''))
        .reverse()
        .join('\n')
    }
    let out = ''
    for (const ch of s) out += styler(ch)
    return out
  }
}

export default util
