import type { Utility } from '@/types/utility'

const ESCAPES: Record<string, string> = { n: '\n', r: '\r', t: '\t', '\\': '\\' }
const decodeEscapes = (s: string) => s.replace(/\\([nrt\\])/g, (m, c: string) => ESCAPES[c] ?? m)

// A word is a run of letters/digits, so punctuation, whitespace and hyphens all
// break words ("Jean-Luc" -> J, L; "U.S.A." -> U, S, A). Apostrophes stay inside
// a word so "don't" contributes a single initial.
const WORD_RE = /[\p{L}\p{N}][\p{L}\p{N}'’]*/gu

const LETTER_RE = /[\p{L}\p{N}]/u

// `toUpperCase()` can map one code point to several — 'ß' -> 'SS', 'ﬁ' -> 'FI',
// 'ŉ' -> 'ʼN'. Left alone that makes a single word contribute two or three
// characters to the acronym and throws the max-length count off, so keep the
// first letter of the mapping: one initial per word, always.
const upperInitial = (ch: string) => {
  const up = ch.toUpperCase()
  const cps = Array.from(up)
  if (cps.length <= 1) return up
  return cps.find((c) => LETTER_RE.test(c)) ?? cps[0]
}

const SMALL_WORDS = new Set([
  'a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'from', 'in', 'into', 'nor',
  'of', 'off', 'on', 'onto', 'or', 'over', 'per', 'the', 'to', 'up', 'via', 'vs',
  'with'
])

const util: Utility = {
  id: 'initials',
  name: 'initials / acronym',
  category: 'String Ops',
  description:
    'Build an acronym from the first letter of each word, with options for a joining separator, upper-casing, skipping small words, and a maximum length.',
  accepts: 'string',
  produces: 'string',
  tags: ['acronym', 'abbreviation', 'first letters', 'initialism', 'monogram', 'short name'],
  examples: [
    {
      title: 'skip small words',
      input: 'The Quick Brown Fox',
      params: { separator: '', uppercase: true, skipSmallWords: true, maxLength: 0 },
      output: 'TQBF'
    },
    {
      title: 'dotted acronym',
      input: 'Node.js Foundation',
      params: { separator: '.', uppercase: true, skipSmallWords: false, maxLength: 0 },
      output: 'N.J.F'
    }
  ],
  params: {
    separator: {
      kind: 'string',
      label: 'separator',
      default: '',
      placeholder: 'e.g. . or  -  — \\n and \\t are understood'
    },
    uppercase: { kind: 'boolean', label: 'uppercase', default: true },
    skipSmallWords: { kind: 'boolean', label: 'skip small words', default: false },
    maxLength: { kind: 'number', label: 'max length (0 = no limit)', default: 0, min: 0, integer: true }
  },
  apply: (
    input: any,
    { separator: _separator, uppercase: _uppercase, skipSmallWords: _skipSmallWords, maxLength: _maxLength }: any
  ) => {
    const s = String(input ?? '')
    if (s === '') return ''

    const separator = decodeEscapes(_separator === undefined || _separator === null ? '' : String(_separator))
    const uppercase = _uppercase === undefined ? true : Boolean(_uppercase)
    const skipSmallWords = Boolean(_skipSmallWords)

    const rawMax =
      _maxLength === undefined || _maxLength === null || _maxLength === '' ? 0 : Number(_maxLength)
    if (!Number.isFinite(rawMax) || rawMax < 0) {
      throw new Error('initials: max length must be 0 (no limit) or a positive number')
    }
    const maxLength = Math.floor(rawMax)

    const words = s.match(WORD_RE) ?? []
    const letters: string[] = []
    for (let i = 0; i < words.length; i++) {
      const word = words[i]
      // The leading word is always kept, so "The Beatles" never collapses to "B".
      if (skipSmallWords && letters.length > 0 && SMALL_WORDS.has(word.toLowerCase())) continue
      // Take a whole code point, not a UTF-16 unit, so astral letters survive.
      const first = Array.from(word)[0]
      if (first === undefined) continue
      letters.push(uppercase ? upperInitial(first) : first)
      if (maxLength > 0 && letters.length >= maxLength) break
    }

    return letters.join(separator)
  }
}

export default util
