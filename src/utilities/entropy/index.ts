import type { Utility } from '@/types/utility'

const round = (n: number, digits = 2) => {
  if (!Number.isFinite(n)) return 0
  const f = Math.pow(10, digits)
  return Math.round(n * f) / f
}

/** Shannon entropy in bits per character over the code-point distribution. */
export function shannonBits(chars: string[]): number {
  if (chars.length === 0) return 0
  const freq = new Map<string, number>()
  for (const ch of chars) freq.set(ch, (freq.get(ch) ?? 0) + 1)
  let h = 0
  for (const n of freq.values()) {
    const p = n / chars.length
    h -= p * Math.log2(p)
  }
  return h
}

type Charset = { size: number; classes: string[] }

/**
 * Size of the alphabet an attacker would have to search, derived from the
 * character classes present. Control and non-ASCII characters contribute only
 * the distinct code points actually used (a deliberately conservative floor).
 */
export function charsetOf(chars: string[]): Charset {
  let lower = false
  let upper = false
  let digit = false
  let space = false
  let punct = false
  const controls = new Set<string>()
  const wide = new Set<string>()

  for (const ch of chars) {
    const cp = ch.codePointAt(0) as number
    if (cp >= 97 && cp <= 122) lower = true
    else if (cp >= 65 && cp <= 90) upper = true
    else if (cp >= 48 && cp <= 57) digit = true
    else if (cp === 32) space = true
    else if (cp > 32 && cp < 127) punct = true
    else if (cp < 32 || cp === 127) controls.add(ch)
    else wide.add(ch)
  }

  const classes: string[] = []
  let size = 0
  if (lower) { classes.push('lowercase'); size += 26 }
  if (upper) { classes.push('uppercase'); size += 26 }
  if (digit) { classes.push('digits'); size += 10 }
  if (space) { classes.push('space'); size += 1 }
  if (punct) { classes.push('punctuation'); size += 32 }
  if (controls.size) { classes.push('control'); size += controls.size }
  if (wide.size) { classes.push('non-ASCII'); size += wide.size }

  return { size, classes }
}

function strengthOf(bits: number): string {
  if (bits < 28) return 'very weak'
  if (bits < 36) return 'weak'
  if (bits < 60) return 'reasonable'
  if (bits < 128) return 'strong'
  return 'very strong'
}

const YEAR_SECONDS = 31557600
const UNITS: [number, string][] = [
  [1, 'second'],
  [60, 'minute'],
  [3600, 'hour'],
  [86400, 'day'],
  [2629800, 'month'],
  [YEAR_SECONDS, 'year']
]

/** Humanise a duration given as log10(seconds), so astronomically large values stay finite. */
export function humaniseLog10Seconds(log10s: number): string {
  if (!Number.isFinite(log10s) || log10s < 0) return 'instant'
  for (let i = UNITS.length - 1; i >= 0; i--) {
    const [size, name] = UNITS[i]
    const log10size = Math.log10(size)
    if (log10s < log10size) continue
    const diff = log10s - log10size
    if (diff > 6) break
    const v = Math.round(Math.pow(10, diff))
    return `${v} ${name}${v === 1 ? '' : 's'}`
  }
  const yearsLog = log10s - Math.log10(YEAR_SECONDS)
  if (yearsLog > 60) return 'effectively forever'
  const exp = Math.floor(yearsLog)
  const mantissa = Math.pow(10, yearsLog - exp)
  return `${mantissa.toFixed(1)}e+${exp} years`
}

/** Guesses per second assumed for the crack-time estimate (fast offline attack). */
const GUESSES_PER_SECOND_LOG10 = 10

type Report = {
  unit: string
  length: number
  uniqueCharacters: number
  entropyPerCharacter: number
  totalEntropy: number
  charsetSize: number
  charsetClasses: string[]
  passwordEntropy: number
  passwordEntropyBits: number
  strength: string
  guessesLog10: number
  crackTime: string
}

function analyse(text: string, unit: 'bits' | 'nats'): Report {
  const chars = Array.from(text)
  const length = chars.length
  const toUnit = (bits: number) => (unit === 'nats' ? bits * Math.LN2 : bits)

  if (length === 0) {
    return {
      unit,
      length: 0,
      uniqueCharacters: 0,
      entropyPerCharacter: 0,
      totalEntropy: 0,
      charsetSize: 0,
      charsetClasses: [],
      passwordEntropy: 0,
      passwordEntropyBits: 0,
      strength: 'empty',
      guessesLog10: 0,
      crackTime: 'instant'
    }
  }

  const perCharBits = shannonBits(chars)
  const charset = charsetOf(chars)
  const passwordBits = charset.size > 1 ? length * Math.log2(charset.size) : 0
  const guessesLog10 = passwordBits * Math.log10(2)

  return {
    unit,
    length,
    uniqueCharacters: new Set(chars).size,
    entropyPerCharacter: round(toUnit(perCharBits)),
    totalEntropy: round(toUnit(perCharBits * length)),
    charsetSize: charset.size,
    charsetClasses: charset.classes,
    passwordEntropy: round(toUnit(passwordBits)),
    passwordEntropyBits: round(passwordBits),
    strength: strengthOf(passwordBits),
    guessesLog10: round(guessesLog10),
    // half the keyspace on average
    crackTime: humaniseLog10Seconds(guessesLog10 - Math.log10(2) - GUESSES_PER_SECOND_LOG10)
  }
}

const row = (label: string, value: string | number) => `${(label + ':').padEnd(24)}${value}`

function renderText(r: Report): string {
  return [
    row('entropy', `${r.entropyPerCharacter} ${r.unit}/char`),
    row('total entropy', `${r.totalEntropy} ${r.unit}`),
    row('length', `${r.length} characters`),
    row('unique characters', r.uniqueCharacters),
    row('charset size', `${r.charsetSize}${r.charsetClasses.length ? ` (${r.charsetClasses.join(', ')})` : ''}`),
    row('password entropy', `${r.passwordEntropy} ${r.unit}`),
    row('strength', r.strength),
    row('est. crack time', r.crackTime)
  ].join('\n')
}

const util: Utility = {
  id: 'entropy',
  name: 'entropy',
  category: 'Analysis',
  description:
    'Measure Shannon entropy per character and in total (bits or nats), report the charset size and rate the input as a password.',
  accepts: 'string',
  produces: ['json', 'string'],
  tags: ['shannon entropy', 'randomness', 'password strength', 'information theory', 'bits per character', 'password entropy'],
  params: {
    unit: { kind: 'select', label: 'unit', options: ['bits', 'nats'], default: 'bits' },
    format: { kind: 'select', label: 'output format', options: ['json', 'text'], default: 'json' }
  },
  examples: [
    {
      title: 'a short password',
      input: 'password123',
      output: JSON.stringify(
        {
          unit: 'bits',
          length: 11,
          uniqueCharacters: 10,
          entropyPerCharacter: 3.28,
          totalEntropy: 36.05,
          charsetSize: 36,
          charsetClasses: ['lowercase', 'digits'],
          passwordEntropy: 56.87,
          passwordEntropyBits: 56.87,
          strength: 'reasonable',
          guessesLog10: 17.12,
          crackTime: '3 months'
        },
        null,
        2
      )
    },
    {
      title: 'as a text report',
      input: 'correct horse battery staple',
      params: { format: 'text' },
      output:
        'entropy:                3.49 bits/char\n' +
        'total entropy:          97.85 bits\n' +
        'length:                 28 characters\n' +
        'unique characters:      13\n' +
        'charset size:           27 (lowercase, space)\n' +
        'password entropy:       133.14 bits\n' +
        'strength:               very strong\n' +
        'est. crack time:        1.9e+22 years'
    }
  ],
  apply: (input: any, { unit, format }: any) => {
    const u = String(unit || 'bits')
    if (u !== 'bits' && u !== 'nats') {
      throw new Error(`unknown unit "${u}" (expected bits or nats)`)
    }
    const fmt = String(format || 'json')
    if (fmt !== 'json' && fmt !== 'text') {
      throw new Error(`unknown format "${fmt}" (expected json or text)`)
    }

    const report = analyse(String(input ?? ''), u)
    if (fmt === 'text') return report.length === 0 ? '' : renderText(report)
    return report
  }
}

export default util
