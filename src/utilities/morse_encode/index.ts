import type { Utility } from '@/types/utility'

/**
 * ITU-R M.1677-1 international Morse, plus the common accented letters and the
 * usual prosigns. Order matters: the first entry for a given code is the one a
 * decoder should prefer, so ASCII is listed before the accented aliases.
 */
export const MORSE_PAIRS: ReadonlyArray<readonly [string, string]> = [
  // letters
  ['A', '.-'], ['B', '-...'], ['C', '-.-.'], ['D', '-..'], ['E', '.'],
  ['F', '..-.'], ['G', '--.'], ['H', '....'], ['I', '..'], ['J', '.---'],
  ['K', '-.-'], ['L', '.-..'], ['M', '--'], ['N', '-.'], ['O', '---'],
  ['P', '.--.'], ['Q', '--.-'], ['R', '.-.'], ['S', '...'], ['T', '-'],
  ['U', '..-'], ['V', '...-'], ['W', '.--'], ['X', '-..-'], ['Y', '-.--'],
  ['Z', '--..'],
  // digits
  ['0', '-----'], ['1', '.----'], ['2', '..---'], ['3', '...--'], ['4', '....-'],
  ['5', '.....'], ['6', '-....'], ['7', '--...'], ['8', '---..'], ['9', '----.'],
  // punctuation
  ['.', '.-.-.-'], [',', '--..--'], ['?', '..--..'], ["'", '.----.'],
  ['!', '-.-.--'], ['/', '-..-.'], ['(', '-.--.'], [')', '-.--.-'],
  ['&', '.-...'], [':', '---...'], [';', '-.-.-.'], ['=', '-...-'],
  ['+', '.-.-.'], ['-', '-....-'], ['_', '..--.-'], ['"', '.-..-.'],
  ['$', '...-..-'], ['@', '.--.-.'],
  // accented / extended letters (aliases come after their canonical partner)
  ['À', '.--.-'], ['Å', '.--.-'],
  ['Ä', '.-.-'], ['Æ', '.-.-'], ['Ą', '.-.-'],
  ['Ç', '-.-..'], ['Ĉ', '-.-..'],
  ['É', '..-..'], ['Đ', '..-..'], ['Ę', '..-..'],
  ['È', '.-..-'], ['Ł', '.-..-'],
  ['Ĝ', '--.-.'],
  ['Ĵ', '.---.'],
  ['Ñ', '--.--'], ['Ń', '--.--'],
  ['Ö', '---.'], ['Ó', '---.'], ['Ø', '---.'],
  ['Ś', '...-...'],
  ['Ŝ', '...-.'],
  ['Š', '----'], ['Ĥ', '----'],
  ['Þ', '.--..'],
  ['Ü', '..--'], ['Ŭ', '..--'],
  ['Ż', '--..-.'], ['Ź', '--..-.']
]

/** Prosign name (without angle brackets) -> Morse. Written as `<SOS>` in text. */
export const PROSIGNS: Readonly<Record<string, string>> = {
  SOS: '...---...',
  SK: '...-.-',
  VA: '...-.-',
  AR: '.-.-.',
  AS: '.-...',
  BT: '-...-',
  BK: '-...-.-',
  CT: '-.-.-',
  KA: '-.-.-',
  KN: '-.--.',
  SN: '...-.',
  VE: '...-.',
  INT: '..-.-',
  NJ: '-..---',
  HH: '........'
}

// Null-prototype lookups: token text comes from user input, so `constructor`
// and friends must not resolve to anything.
const CHAR_TO_MORSE: Record<string, string> = Object.create(null)
for (const [ch, code] of MORSE_PAIRS) {
  if (CHAR_TO_MORSE[ch] === undefined) CHAR_TO_MORSE[ch] = code
}

const PROSIGN_LOOKUP: Record<string, string> = Object.create(null)
for (const [name, code] of Object.entries(PROSIGNS)) PROSIGN_LOOKUP[name] = code

const MAX_PROSIGN_NAME = 5

/** Reads a `<SOS>`-style prosign token at `i`, or returns null. */
const readProsign = (chars: string[], i: number): { code: string; next: number } | null => {
  if (chars[i] !== '<') return null
  const limit = Math.min(chars.length - 1, i + MAX_PROSIGN_NAME + 1)
  for (let j = i + 1; j <= limit; j++) {
    if (chars[j] !== '>') continue
    const name = chars.slice(i + 1, j).join('').toUpperCase()
    const code = PROSIGN_LOOKUP[name]
    return code === undefined ? null : { code, next: j + 1 }
  }
  return null
}

/**
 * Morse for a single code point. `ß` and the typographic ligatures upper-case
 * to more than one letter, so those expand to several Morse tokens.
 */
const codesFor = (ch: string): string[] | null => {
  const direct = CHAR_TO_MORSE[ch]
  if (direct !== undefined) return [direct]
  const upper = ch.toUpperCase()
  if (upper === ch) return null
  const codes: string[] = []
  for (const part of upper) {
    const code = CHAR_TO_MORSE[part]
    if (code === undefined) return null
    codes.push(code)
  }
  return codes.length > 0 ? codes : null
}

/** Encodes one whitespace-free word into a list of Morse (or passed-through) tokens. */
const encodeWord = (word: string, onUnknown: string): string[] => {
  const chars = Array.from(word)
  const tokens: string[] = []
  let i = 0
  while (i < chars.length) {
    const prosign = readProsign(chars, i)
    if (prosign) {
      tokens.push(prosign.code)
      i = prosign.next
      continue
    }
    const ch = chars[i]
    i++
    const codes = codesFor(ch)
    if (codes) {
      tokens.push(...codes)
    } else if (onUnknown === 'error') {
      const hex = (ch.codePointAt(0) as number).toString(16).toUpperCase().padStart(4, '0')
      throw new Error(`morse: no Morse code for "${ch}" (U+${hex})`)
    } else if (onUnknown === 'keep') {
      tokens.push(ch)
    }
    // 'skip' drops the character
  }
  return tokens
}

const util: Utility = {
  id: 'morse_encode',
  name: 'morse encode',
  category: 'Encoding',
  description:
    'Convert text to Morse code (letters, digits, punctuation, accented letters and <SOS>-style prosigns) with configurable letter and word separators, erroring, skipping or keeping unsupported characters.',
  accepts: 'string',
  produces: 'string',
  tags: ['morse', 'code', 'encode', 'dots and dashes', 'telegraph', 'itu'],
  params: {
    letterSeparator: { kind: 'string', label: 'letter separator', default: ' ' },
    wordSeparator: { kind: 'string', label: 'word separator', default: ' / ' },
    onUnknown: {
      kind: 'select',
      label: 'unknown characters',
      options: ['error', 'skip', 'keep'],
      default: 'skip'
    }
  },
  examples: [
    { title: 'prosign', input: 'SOS', output: '... --- ...' },
    { title: 'two words', input: 'Hello World', output: '.... . .-.. .-.. --- / .-- --- .-. .-.. -..' }
  ],
  apply: (input: any, { letterSeparator, wordSeparator, onUnknown }: any) => {
    const s = String(input ?? '')
    if (!s.trim()) return ''

    const letterSep = letterSeparator === undefined || letterSeparator === null ? ' ' : String(letterSeparator)
    const wordSep = wordSeparator === undefined || wordSeparator === null ? ' / ' : String(wordSeparator)
    const unknown = onUnknown || 'skip'

    // Line structure survives the trip: morse_decode rebuilds one line per
    // newline, so encoding line by line keeps the pair an exact inverse.
    return s
      .split(/\r?\n/)
      .map((line) =>
        line
          .trim()
          .split(/\s+/)
          .map((word) => encodeWord(word, unknown).join(letterSep))
          .filter((word) => word.length > 0)
          .join(wordSep)
      )
      .join('\n')
  }
}

export default util
