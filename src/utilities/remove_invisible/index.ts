import type { Utility, Value } from '@/types/utility'

const MODES = ['remove', 'reveal', 'list']

/** Tab, newline and carriage return are legitimate text — never touched. */
const KEEP = new Set([0x09, 0x0a, 0x0d])

const C0_NAMES = [
  'NULL', 'START OF HEADING', 'START OF TEXT', 'END OF TEXT', 'END OF TRANSMISSION',
  'ENQUIRY', 'ACKNOWLEDGE', 'BELL', 'BACKSPACE', 'CHARACTER TABULATION', 'LINE FEED',
  'LINE TABULATION', 'FORM FEED', 'CARRIAGE RETURN', 'SHIFT OUT', 'SHIFT IN',
  'DATA LINK ESCAPE', 'DEVICE CONTROL ONE', 'DEVICE CONTROL TWO', 'DEVICE CONTROL THREE',
  'DEVICE CONTROL FOUR', 'NEGATIVE ACKNOWLEDGE', 'SYNCHRONOUS IDLE',
  'END OF TRANSMISSION BLOCK', 'CANCEL', 'END OF MEDIUM', 'SUBSTITUTE', 'ESCAPE',
  'INFORMATION SEPARATOR FOUR', 'INFORMATION SEPARATOR THREE', 'INFORMATION SEPARATOR TWO',
  'INFORMATION SEPARATOR ONE'
]

const C1_NAMES: Record<number, string> = {
  0x85: 'NEXT LINE',
  0x88: 'CHARACTER TABULATION SET',
  0x8d: 'REVERSE LINE FEED',
  0x9b: 'CONTROL SEQUENCE INTRODUCER',
  0x9c: 'STRING TERMINATOR'
}

const NAMES: Record<number, string> = {
  0x7f: 'DELETE',
  0xad: 'SOFT HYPHEN',
  0x61c: 'ARABIC LETTER MARK',
  0x180e: 'MONGOLIAN VOWEL SEPARATOR',
  0x200b: 'ZERO WIDTH SPACE',
  0x200c: 'ZERO WIDTH NON-JOINER',
  0x200d: 'ZERO WIDTH JOINER',
  0x200e: 'LEFT-TO-RIGHT MARK',
  0x200f: 'RIGHT-TO-LEFT MARK',
  0x202a: 'LEFT-TO-RIGHT EMBEDDING',
  0x202b: 'RIGHT-TO-LEFT EMBEDDING',
  0x202c: 'POP DIRECTIONAL FORMATTING',
  0x202d: 'LEFT-TO-RIGHT OVERRIDE',
  0x202e: 'RIGHT-TO-LEFT OVERRIDE',
  0x2060: 'WORD JOINER',
  0x2061: 'FUNCTION APPLICATION',
  0x2062: 'INVISIBLE TIMES',
  0x2063: 'INVISIBLE SEPARATOR',
  0x2064: 'INVISIBLE PLUS',
  0x2066: 'LEFT-TO-RIGHT ISOLATE',
  0x2067: 'RIGHT-TO-LEFT ISOLATE',
  0x2068: 'FIRST STRONG ISOLATE',
  0x2069: 'POP DIRECTIONAL ISOLATE',
  0xfeff: 'ZERO WIDTH NO-BREAK SPACE (BOM)'
}

export function isInvisible(cp: number): boolean {
  if (cp <= 0x1f) return !KEEP.has(cp)
  if (cp === 0x7f) return true
  if (cp >= 0x80 && cp <= 0x9f) return true // C1 controls
  if (cp === 0xad || cp === 0x61c || cp === 0x180e) return true
  if (cp >= 0x200b && cp <= 0x200f) return true // zero width + directional marks
  if (cp >= 0x202a && cp <= 0x202e) return true // bidi embedding / override
  if (cp >= 0x2060 && cp <= 0x2064) return true // word joiner + invisible operators
  if (cp >= 0x2066 && cp <= 0x2069) return true // bidi isolates
  if (cp === 0xfeff) return true
  if (cp >= 0xfe00 && cp <= 0xfe0f) return true // variation selectors 1-16
  if (cp >= 0xe0000 && cp <= 0xe007f) return true // tag characters
  if (cp >= 0xe0100 && cp <= 0xe01ef) return true // variation selectors supplement
  return false
}

export function nameOf(cp: number): string {
  if (cp <= 0x1f) return C0_NAMES[cp]
  if (NAMES[cp]) return NAMES[cp]
  if (cp >= 0x80 && cp <= 0x9f) return C1_NAMES[cp] ?? 'C1 CONTROL'
  if (cp >= 0xfe00 && cp <= 0xfe0f) return `VARIATION SELECTOR-${cp - 0xfe00 + 1}`
  if (cp >= 0xe0100 && cp <= 0xe01ef) return `VARIATION SELECTOR-${cp - 0xe0100 + 17}`
  if (cp === 0xe0001) return 'LANGUAGE TAG'
  if (cp === 0xe007f) return 'CANCEL TAG'
  if (cp >= 0xe0020 && cp <= 0xe007e) return `TAG ${String.fromCodePoint(cp - 0xe0000)}`
  if (cp >= 0xe0000 && cp <= 0xe007f) return 'TAG CHARACTER'
  return 'UNKNOWN'
}

const hex = (cp: number) => `U+${cp.toString(16).toUpperCase().padStart(4, '0')}`

const util: Utility = {
  id: 'remove_invisible',
  name: 'invisible characters',
  category: 'Analysis',
  description:
    'Find zero-width, bidi, control, tag and variation-selector characters — remove them, reveal them as visible U+XXXX markers, or list every one with its name and position.',
  accepts: 'string',
  produces: ['string', 'json'],
  tags: ['zero width space', 'bidi characters', 'hidden characters', 'strip control characters', 'unicode steganography', 'invisible unicode'],
  params: {
    mode: { kind: 'select', label: 'mode', options: MODES, default: 'remove' }
  },
  examples: [
    {
      title: 'list zero-width spaces',
      input: 'a​b​c',
      params: { mode: 'list' },
      output: JSON.stringify(
        [
          { codePoint: 'U+200B', name: 'ZERO WIDTH SPACE', index: 1 },
          { codePoint: 'U+200B', name: 'ZERO WIDTH SPACE', index: 3 }
        ],
        null,
        2
      )
    },
    {
      title: 'remove them',
      input: 'a​b',
      params: { mode: 'remove' },
      output: 'ab'
    }
  ],
  apply: (input: any, params: any = {}) => {
    const s = String(input ?? '')
    const mode = params.mode ?? 'remove'

    if (typeof mode !== 'string' || !MODES.includes(mode)) {
      throw new Error(`unknown mode: ${String(mode)} (expected remove, reveal or list)`)
    }

    if (mode === 'list') {
      const found: Array<Record<string, unknown>> = []
      let index = 0
      for (const ch of Array.from(s)) {
        const cp = ch.codePointAt(0) as number
        if (isInvisible(cp)) found.push({ codePoint: hex(cp), name: nameOf(cp), index })
        index++
      }
      return found as unknown as Value
    }

    let out = ''
    for (const ch of Array.from(s)) {
      const cp = ch.codePointAt(0) as number
      if (!isInvisible(cp)) out += ch
      else if (mode === 'reveal') out += `‹${hex(cp)}›`
    }
    return out
  }
}

export default util
