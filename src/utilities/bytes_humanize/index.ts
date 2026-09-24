import type { Utility } from '@/types/utility'

const BINARY_UNITS = ['B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB']
const DECIMAL_UNITS = ['B', 'kB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']

const PREFIXES = [
  { short: 'k', si: 'kilo', bin: 'kibi' },
  { short: 'm', si: 'mega', bin: 'mebi' },
  { short: 'g', si: 'giga', bin: 'gibi' },
  { short: 't', si: 'tera', bin: 'tebi' },
  { short: 'p', si: 'peta', bin: 'pebi' },
  { short: 'e', si: 'exa', bin: 'exbi' },
  { short: 'z', si: 'zetta', bin: 'zebi' },
  { short: 'y', si: 'yotta', bin: 'yobi' }
]

type SuffixInfo = { exponent: number; forceBinary: boolean }

/** Lower-cased size suffix -> which power it means, and whether it is explicitly 1024-based. */
const SUFFIXES: Record<string, SuffixInfo> = (() => {
  const map: Record<string, SuffixInfo> = {}
  for (const s of ['', 'b', 'byte', 'bytes', 'o', 'octet', 'octets']) {
    map[s] = { exponent: 0, forceBinary: false }
  }
  PREFIXES.forEach((p, i) => {
    const exponent = i + 1
    for (const s of [p.short, `${p.short}b`, `${p.si}byte`, `${p.si}bytes`]) {
      map[s] = { exponent, forceBinary: false }
    }
    // IEC forms always mean powers of 1024, whatever the `unit` option says
    for (const s of [`${p.short}i`, `${p.short}ib`, `${p.bin}byte`, `${p.bin}bytes`]) {
      map[s] = { exponent, forceBinary: true }
    }
  })
  return map
})()

/** Read "1.234,5" / "1,234.5" / "1 234" style numbers without guessing wrong. */
const normalizeNumericText = (s: string, original: string): string => {
  let text = s
  const lastDot = text.lastIndexOf('.')
  const lastComma = text.lastIndexOf(',')
  if (lastDot >= 0 && lastComma >= 0) {
    if (lastComma > lastDot) text = text.replace(/\./g, '').replace(',', '.')
    else text = text.replace(/,/g, '')
  } else if (lastComma >= 0) {
    if (/^[+-]?\d{1,3}(,\d{3})+$/.test(text)) text = text.replace(/,/g, '')
    else text = text.replace(',', '.')
  } else if (/^[+-]?\d{1,3}(\.\d{3}){2,}$/.test(text)) {
    text = text.replace(/\./g, '')
  }
  if (!/^[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?$/.test(text)) {
    throw new Error(`"${original}" is not a byte size`)
  }
  return text
}

/**
 * Multiply a decimal string by base**exponent exactly, rounding half away from zero,
 * so that huge sizes like "1 YB" stay exact instead of drifting through a double.
 */
const exactBytes = (numericText: string, base: number, exponent: number): bigint => {
  let text = numericText
  let sign = 1n
  if (text.charAt(0) === '-') {
    sign = -1n
    text = text.slice(1)
  } else if (text.charAt(0) === '+') {
    text = text.slice(1)
  }

  let power = 0
  const e = text.search(/[eE]/)
  if (e >= 0) {
    power = parseInt(text.slice(e + 1), 10)
    text = text.slice(0, e)
  }
  const dot = text.indexOf('.')
  let scale = 0
  if (dot >= 0) {
    scale = text.length - dot - 1
    text = text.slice(0, dot) + text.slice(dot + 1)
  }
  scale -= power

  let numerator = BigInt(text || '0')
  let denominator = 1n
  if (scale > 0) denominator = 10n ** BigInt(scale)
  else if (scale < 0) numerator *= 10n ** BigInt(-scale)
  numerator *= BigInt(base) ** BigInt(exponent)

  const quotient = numerator / denominator
  const remainder = numerator % denominator
  return sign * (remainder * 2n >= denominator ? quotient + 1n : quotient)
}

/** Parse "1.5 GiB", "10MB", "1024" into a byte count (as a double, and exactly). */
export function parseByteSize(raw: string, binaryDefault: boolean): { bytes: number; exact: bigint } {
  const original = raw.trim()
  const cleaned = original.replace(/[\s'_]/g, '')
  if (!cleaned) throw new Error('no byte size to convert')

  const match = /^([+-]?[\d.,]+(?:[eE][+-]?\d+)?)([a-zA-Z]*)$/.exec(cleaned)
  if (!match) throw new Error(`"${original}" is not a byte size`)

  const numericText = normalizeNumericText(match[1], original)
  const value = Number(numericText)
  if (!Number.isFinite(value)) throw new Error(`"${original}" is not a finite byte size`)

  const suffix = match[2].toLowerCase()
  const info = Object.prototype.hasOwnProperty.call(SUFFIXES, suffix) ? SUFFIXES[suffix] : undefined
  if (!info) throw new Error(`unknown size unit "${match[2]}"`)

  const base = info.forceBinary || binaryDefault ? 1024 : 1000
  return {
    bytes: value * Math.pow(base, info.exponent),
    exact: exactBytes(numericText, base, info.exponent)
  }
}

/** Render a byte count as "1.50 GiB" / "1.61 GB". */
export function humanizeBytes(bytes: number, binary: boolean, decimals: number): string {
  const units = binary ? BINARY_UNITS : DECIMAL_UNITS
  const base = binary ? 1024 : 1000
  const sign = bytes < 0 ? '-' : ''
  const abs = Math.abs(bytes)

  let exponent = abs > 0 ? Math.floor(Math.log(abs) / Math.log(base)) : 0
  if (exponent < 0) exponent = 0
  if (exponent > units.length - 1) exponent = units.length - 1

  // whole bytes never get decimal places; everything above scales and rounds
  const render = (exp: number) =>
    exp === 0 ? String(Math.round(abs)) : (abs / Math.pow(base, exp)).toFixed(decimals)

  let text = render(exponent)
  if (Number(text) >= base && exponent < units.length - 1) {
    exponent += 1
    text = render(exponent)
  }
  return `${sign}${text} ${units[exponent]}`
}

const util: Utility = {
  id: 'bytes_humanize',
  name: 'humanize bytes',
  category: 'Numbers',
  description:
    'Convert byte counts to readable sizes like 1.50 GiB and back again, using binary (KiB) or decimal (kB) units and a chosen number of decimal places.',
  accepts: 'string',
  produces: 'string',
  params: {
    direction: { kind: 'select', label: 'direction', options: ['to-human', 'to-bytes'], default: 'to-human' },
    unit: { kind: 'select', label: 'units', options: ['binary', 'decimal'], default: 'binary' },
    decimals: { kind: 'number', label: 'decimal places', default: 2, min: 0, max: 20, integer: true },
    perLine: { kind: 'boolean', label: 'one size per line', default: true }
  },
  tags: ['byte size', 'file size', 'kib mib gib', 'human readable size', 'bytes converter', 'filesize'],
  examples: [
    { title: 'to human (binary)', input: '1536', params: { direction: 'to-human', unit: 'binary' }, output: '1.50 KiB' },
    { title: 'to bytes', input: '1.5 GiB', params: { direction: 'to-bytes' }, output: '1610612736' }
  ],
  apply: (input: any, params: any) => {
    const s = String(input ?? '')
    const { direction: directionRaw, unit: unitRaw, decimals: decimalsRaw, perLine = true } = params || {}

    const direction = directionRaw === 'to-bytes' ? 'to-bytes' : 'to-human'
    const binary = unitRaw !== 'decimal'
    const decimalsNumber = decimalsRaw === '' || decimalsRaw == null ? 2 : Number(decimalsRaw)
    if (!Number.isFinite(decimalsNumber)) throw new Error('decimal places must be a number')
    const decimals = Math.min(20, Math.max(0, Math.trunc(decimalsNumber)))

    const convert = (token: string) => {
      const { bytes, exact } = parseByteSize(token, binary)
      return direction === 'to-bytes' ? exact.toString() : humanizeBytes(bytes, binary, decimals)
    }

    if (!s.trim()) return ''
    if (perLine === false || perLine === 'false') return convert(s)
    return s
      .split(/\r?\n/)
      .map((line) => (line.trim() ? convert(line) : line))
      .join('\n')
  }
}

export default util
