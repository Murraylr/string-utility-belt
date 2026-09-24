import type { Utility } from '@/types/utility'
import { MORSE_PAIRS, PROSIGNS } from '../morse_encode'

/**
 * Reverse Morse table. The first entry that claims a code wins, so ASCII beats
 * the accented aliases and real characters beat prosigns that share their code
 * (`.-.-.` stays `+` rather than becoming `<AR>`).
 */
// Null-prototype: token text comes from user input, so a token like
// `constructor` must not resolve to an inherited property.
const MORSE_TO_CHAR: Record<string, string> = Object.create(null)
for (const [ch, code] of MORSE_PAIRS) {
  if (MORSE_TO_CHAR[code] === undefined) MORSE_TO_CHAR[code] = ch
}
for (const [name, code] of Object.entries(PROSIGNS)) {
  if (MORSE_TO_CHAR[code] === undefined) MORSE_TO_CHAR[code] = `<${name}>`
}

/** Symbols people type instead of a plain `.` or `-`. */
const DOT_ALIASES = new Set(['·', '•', '∙', '・'])
const DASH_ALIASES = new Set(['−', '–', '—', '―', '_'])

/** Word gaps: a slash or pipe (with any surrounding space), or three-plus spaces. */
const WORD_SPLIT = /\s*[/|]+\s*|\s{3,}/

const normalizeSymbols = (s: string): string => {
  let out = ''
  for (const ch of s) {
    if (DOT_ALIASES.has(ch)) out += '.'
    else if (DASH_ALIASES.has(ch)) out += '-'
    else out += ch
  }
  return out
}

const decodeToken = (token: string): string => {
  const found = MORSE_TO_CHAR[token]
  if (found !== undefined) return found
  // Anything made purely of dots and dashes was meant to be Morse.
  if (/^[.-]+$/.test(token)) {
    throw new Error(`morse: unknown sequence "${token}"`)
  }
  // Otherwise it is a literal that morse encode kept verbatim — pass it through.
  return token
}

const decodeLine = (line: string): string =>
  line
    .split(WORD_SPLIT)
    .map((word) =>
      word
        .trim()
        .split(/\s+/)
        .filter((token) => token.length > 0)
        .map(decodeToken)
        .join('')
    )
    .filter((word) => word.length > 0)
    .join(' ')

const util: Utility = {
  id: 'morse_decode',
  name: 'morse decode',
  category: 'Decoding',
  description:
    'Convert Morse code back to text, tolerating ·/— style symbols, slash, pipe or wide-space word gaps, and passing non-Morse characters through unchanged.',
  accepts: 'string',
  produces: 'string',
  params: {},
  tags: ['morse', 'morse code', 'decode', 'dots and dashes', 'telegraph'],
  examples: [
    {
      title: 'decode a word',
      input: '.... . .-.. .-.. ---',
      output: 'HELLO'
    }
  ],
  apply: (input: any) => {
    const s = String(input ?? '')
    if (!s.trim()) return ''
    return normalizeSymbols(s)
      .split(/\r?\n/)
      .map(decodeLine)
      .join('\n')
  }
}

export default util
