import type { Utility } from '@/types/utility'

/**
 * roman numerals
 *
 * to-roman   : 1–3999 → standard subtractive notation (MCMXCIV)
 * to-arabic  : strict validation — IIII, VV, IC and friends are rejected.
 *              Unicode Number Forms (Ⅻ, ⅳ, …) are expanded before parsing.
 */

const ROMAN_TABLE: Array<[number, string]> = [
  [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'],
  [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'],
  [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']
]

const LETTER_VALUES: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 }

/** U+2160..U+216F (uppercase) and U+2170..U+217F (lowercase) Number Forms. */
const NUMBER_FORMS = [
  'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'L', 'C', 'D', 'M'
]
const UNICODE_ROMAN: Record<string, string> = {}
NUMBER_FORMS.forEach((expansion, i) => {
  UNICODE_ROMAN[String.fromCodePoint(0x2160 + i)] = expansion
  UNICODE_ROMAN[String.fromCodePoint(0x2170 + i)] = expansion
})

const STRICT_ROMAN = /^M{0,3}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/

const MIN_ROMAN = 1
const MAX_ROMAN = 3999

/**
 * A digit-group separator: comma, underscore, or horizontal whitespace (plain
 * space, NBSP, thin space, narrow NBSP). Newlines are excluded so a two-line
 * input is never welded into one number.
 */
const GROUP_SEP = /[,_]|[^\S\n\r]/g
/** Well-formed grouping only: 1-3 digits, then 3-digit groups. */
const GROUPED = /^\d{1,3}(?:(?:[,_]|[^\S\n\r])\d{3})+$/

/**
 * Strip digit-group separators, but only from a correctly grouped run, so that
 * "1 0" and "1,0,6,6" are rejected rather than silently read as 10 and 1066.
 */
const stripGroups = (digits: string): string =>
  GROUPED.test(digits) ? digits.replace(GROUP_SEP, '') : digits

const toRoman = (raw: string): string => {
  const source = raw.trim()
  const sign = /^([+\-−–])\s*/.exec(source)
  const digits = stripGroups(sign ? source.slice(sign[0].length) : source)
  if (!/^\d+$/.test(digits)) {
    throw new Error(`not a whole number: ${JSON.stringify(source)}`)
  }
  const n = (sign && sign[1] !== '+' ? -1 : 1) * Number(digits)
  if (!(n >= MIN_ROMAN && n <= MAX_ROMAN)) {
    throw new Error(`roman numerals cover ${MIN_ROMAN}-${MAX_ROMAN}, got ${n}`)
  }
  let rest = n
  let out = ''
  for (const [value, symbol] of ROMAN_TABLE) {
    while (rest >= value) {
      out += symbol
      rest -= value
    }
  }
  return out
}

/** Expand Unicode Number Forms code point by code point, then upper-case. */
const normalizeRoman = (raw: string): string =>
  Array.from(raw)
    .map((ch) => UNICODE_ROMAN[ch] ?? ch)
    .join('')
    .replace(/[\s.]/g, '')
    .toUpperCase()

const toArabic = (raw: string): string => {
  const source = raw.trim()
  const roman = normalizeRoman(source)
  if (!roman) throw new Error(`not a roman numeral: ${JSON.stringify(source)}`)
  if (!STRICT_ROMAN.test(roman)) {
    throw new Error(`invalid roman numeral: ${JSON.stringify(source)}`)
  }
  const letters = Array.from(roman)
  let total = 0
  for (let i = 0; i < letters.length; i++) {
    const value = LETTER_VALUES[letters[i]]
    const next = i + 1 < letters.length ? LETTER_VALUES[letters[i + 1]] : 0
    total += value < next ? -value : value
  }
  return String(total)
}

const DIRECTIONS = ['to-roman', 'to-arabic']

const util: Utility = {
  id: 'roman_numerals',
  name: 'roman numerals',
  category: 'Numbers',
  description:
    'Convert whole numbers (1-3999) to Roman numerals, or parse strictly-formed Roman numerals back to numbers, one value per line.',
  accepts: 'string',
  produces: 'string',
  params: {
    direction: {
      kind: 'select',
      label: 'direction',
      options: ['to-roman', 'to-arabic'],
      default: 'to-roman'
    },
    perLine: {
      kind: 'boolean',
      label: 'one value per line',
      default: true
    }
  },
  tags: ['roman numerals', 'arabic to roman', 'mcmxciv', 'numeral conversion', 'clock numerals'],
  examples: [
    { title: 'to roman', input: '1994', params: { direction: 'to-roman' }, output: 'MCMXCIV' },
    { title: 'to arabic', input: 'MCMXCIV', params: { direction: 'to-arabic' }, output: '1994' }
  ],
  apply: (input: any, params: any) => {
    const s = String(input ?? '')
    const direction = String(params?.direction ?? 'to-roman')
    const perLine = params?.perLine === undefined ? true : Boolean(params.perLine)

    if (!DIRECTIONS.includes(direction)) throw new Error(`unknown direction: ${JSON.stringify(direction)}`)
    if (!s.trim()) return s

    const convert = (value: string) => (direction === 'to-arabic' ? toArabic(value) : toRoman(value))

    const applyKeepingPadding = (segment: string) => {
      // trimStart/trimEnd, not /^(\s*)([\s\S]*?)(\s*)$/: that regex is quadratic on a
      // long run of spaces inside the segment
      const body = segment.trimStart()
      const core = body.trimEnd()
      if (!core) return segment
      return segment.slice(0, segment.length - body.length) + convert(core) + body.slice(core.length)
    }

    if (!perLine) return applyKeepingPadding(s)
    return s.split('\n').map(applyKeepingPadding).join('\n')
  }
}

export default util
