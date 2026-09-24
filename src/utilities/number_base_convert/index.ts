import type { Utility } from '@/types/utility'

/**
 * Radix prefixes we understand on input and can emit on output.
 * Bases without a conventional prefix simply get none.
 */
const BASE_PREFIX: Record<number, string> = { 2: '0b', 8: '0o', 16: '0x' }

const PREFIX_BASES: Array<[RegExp, number]> = [
  [/^0x/i, 16],
  [/^0b/i, 2],
  [/^0o/i, 8]
]

/** Digit-group separators that are ignored when reading a number. */
const stripSeparators = (s: string) => s.replace(/[\s_,']/g, '')

const readBase = (raw: unknown, fallback: number, label: string, allowZero: boolean): number => {
  if (raw === '' || raw == null) return fallback
  const n = Number(raw)
  if (!Number.isFinite(n) || !Number.isInteger(n)) throw new Error(`${label} base must be a whole number`)
  if (allowZero && n === 0) return 0
  if (n < 2 || n > 36) throw new Error(`${label} base must be between 2 and 36 (got ${n})`)
  return n
}

const groupFromRight = (digits: string, size: number, separator = ' ') => {
  if (size <= 0 || digits.length <= size) return digits
  const parts: string[] = []
  for (let end = digits.length; end > 0; end -= size) {
    parts.unshift(digits.slice(Math.max(0, end - size), end))
  }
  return parts.join(separator)
}

/** Parse one token into an exact BigInt, honouring `from` (0 = auto-detect by prefix). */
export function parseInBase(raw: string, from: number): bigint {
  const original = raw.trim()
  const cleaned = stripSeparators(raw)
  if (!cleaned) throw new Error('no number to convert')
  if (cleaned.indexOf('.') >= 0) {
    throw new Error(`only whole numbers are supported (got "${original}")`)
  }

  let negative = false
  let body = cleaned
  if (body.charAt(0) === '-') {
    negative = true
    body = body.slice(1)
  } else if (body.charAt(0) === '+') {
    body = body.slice(1)
  }
  if (!body) throw new Error(`"${original}" is not a number`)

  let detected = 0
  for (const [re, base] of PREFIX_BASES) {
    if (re.test(body)) {
      detected = base
      break
    }
  }

  let base = from
  if (from === 0) {
    base = detected || 10
    if (detected) body = body.slice(2)
  } else if (detected === from) {
    // strip a prefix only when it agrees with the declared base ("0xff" in base 16);
    // "0b1" read as base 16 is a legitimate hex number and must stay intact
    body = body.slice(2)
  }
  if (!body) throw new Error(`"${original}" has no digits`)

  const value = BigInt(base)
  let out = 0n
  for (const ch of Array.from(body)) {
    const digit = parseInt(ch, 36)
    if (Number.isNaN(digit) || digit >= base || !/^[0-9a-z]$/i.test(ch)) {
      throw new Error(`"${ch}" is not a valid digit in base ${base}`)
    }
    out = out * value + BigInt(digit)
  }
  return negative ? -out : out
}

export function formatInBase(
  value: bigint,
  to: number,
  uppercase: boolean,
  prefix: boolean,
  groupDigits: number
): string {
  const negative = value < 0n
  let digits = (negative ? -value : value).toString(to)
  if (uppercase) digits = digits.toUpperCase()
  if (groupDigits > 0) digits = groupFromRight(digits, groupDigits)
  const pfx = prefix ? (BASE_PREFIX[to] || '') : ''
  return `${negative ? '-' : ''}${pfx}${digits}`
}

const util: Utility = {
  id: 'number_base_convert',
  name: 'number base convert',
  category: 'Numbers',
  description:
    'Convert whole numbers between any bases from 2 to 36 with exact BigInt precision, with auto-detection of 0x/0b/0o prefixes, optional output prefix, uppercase digits and digit grouping.',
  accepts: 'string',
  produces: 'string',
  params: {
    from: { kind: 'number', label: 'from base (0 = auto-detect)', default: 10, min: 0, max: 36, integer: true },
    to: { kind: 'number', label: 'to base', default: 16, min: 2, max: 36, integer: true },
    uppercase: { kind: 'boolean', label: 'uppercase digits', default: false },
    prefix: { kind: 'boolean', label: 'add base prefix (0x / 0b / 0o)', default: false },
    groupDigits: { kind: 'number', label: 'group digits every N (0 = off)', default: 0, min: 0, integer: true },
    perLine: { kind: 'boolean', label: 'one number per line', default: true }
  },
  tags: ['base conversion', 'hex decimal binary', 'radix convert', 'number base', 'binary to hex', 'octal'],
  aliases: ['base convert'],
  examples: [
    { title: 'decimal to hex', input: '255', params: { from: 10, to: 16 }, output: 'ff' },
    { title: 'auto-detect to binary', input: '0xff', params: { from: 0, to: 2 }, output: '11111111' }
  ],
  apply: (input: any, params: any) => {
    const s = String(input ?? '')
    const {
      from: fromRaw,
      to: toRaw,
      uppercase = false,
      prefix = false,
      groupDigits: groupRaw,
      perLine = true
    } = params || {}

    const from = readBase(fromRaw, 10, 'source', true)
    const to = readBase(toRaw, 16, 'target', false)
    const groupDigits = Math.max(0, Math.trunc(Number(groupRaw) || 0))
    const upper = uppercase === true || uppercase === 'true'
    const withPrefix = prefix === true || prefix === 'true'

    const convert = (token: string) => formatInBase(parseInBase(token, from), to, upper, withPrefix, groupDigits)

    if (perLine === false || perLine === 'false') {
      if (!s.trim()) return ''
      return convert(s)
    }

    if (!s.trim()) return ''
    return s
      .split(/\r?\n/)
      .map((line) => (line.trim() ? convert(line) : line))
      .join('\n')
  }
}

export default util
