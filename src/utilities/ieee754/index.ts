import type { Utility } from '@/types/utility'

type Precision = 'double' | 'single'
type Direction = 'to-bits' | 'to-number'
type Format = 'binary' | 'hex' | 'breakdown'
type Classification = 'zero' | 'subnormal' | 'normal' | 'infinity' | 'nan'

type Rational = { num: bigint; den: bigint }

type Spec = { width: number; mantissaBits: number; exponentBits: number; bias: number }

const SPECS: Record<Precision, Spec> = {
  double: { width: 64, mantissaBits: 52, exponentBits: 11, bias: 1023 },
  single: { width: 32, mantissaBits: 23, exponentBits: 8, bias: 127 }
}

const pow10 = (n: number) => 10n ** BigInt(n)

/** Exact rational value of a decimal literal such as `-1.25e-3`. Null when unparseable. */
export function decimalToRational(text: string): Rational | null {
  const m = /^([+-]?)(\d*)(?:\.(\d*))?(?:[eE]([+-]?\d+))?$/.exec(text)
  if (!m) return null
  const sign = m[1]
  const int = m[2] ?? ''
  const frac = m[3] ?? ''
  if (!int && !frac) return null
  let num = BigInt((int || '0') + frac)
  let den = pow10(frac.length)
  const exp = m[4] ? Number.parseInt(m[4], 10) : 0
  if (exp > 0) num *= pow10(exp)
  else if (exp < 0) den *= pow10(-exp)
  if (sign === '-') num = -num
  return { num, den }
}

const rationalEquals = (a: Rational, b: Rational) => a.num * b.den === b.num * a.den

function numberToBits(value: number, precision: Precision): bigint {
  const dv = new DataView(new ArrayBuffer(8))
  if (precision === 'single') {
    dv.setFloat32(0, value)
    return BigInt(dv.getUint32(0))
  }
  dv.setFloat64(0, value)
  return dv.getBigUint64(0)
}

function bitsToNumber(bits: bigint, precision: Precision): number {
  const dv = new DataView(new ArrayBuffer(8))
  if (precision === 'single') {
    dv.setUint32(0, Number(bits & 0xffffffffn))
    return dv.getFloat32(0)
  }
  dv.setBigUint64(0, bits & 0xffffffffffffffffn)
  return dv.getFloat64(0)
}

/** Exact decimal expansion of `sig * 2^exp` (always finite: the denominator is a power of two). */
export function exactDecimal(sig: bigint, exp: number, negative: boolean): string {
  let body: string
  if (sig === 0n) body = '0'
  else if (exp >= 0) body = (sig << BigInt(exp)).toString()
  else {
    const k = -exp
    const scaled = (sig * 5n ** BigInt(k)).toString().padStart(k + 1, '0')
    const intPart = scaled.slice(0, scaled.length - k)
    const frac = scaled.slice(scaled.length - k).replace(/0+$/, '')
    body = frac ? `${intPart}.${frac}` : intPart
  }
  return (negative ? '-' : '') + body
}

const showNumber = (value: number) => (Object.is(value, -0) ? '-0' : String(value))

function parseLiteral(raw: string): { value: number; rational: Rational | null } {
  const text = raw.trim().replace(/_/g, '')
  const lower = text.toLowerCase()
  if (/^[+-]?nan$/.test(lower)) return { value: Number.NaN, rational: null }
  if (/^[+-]?(infinity|inf|∞)$/.test(lower)) {
    return { value: lower.startsWith('-') ? -Infinity : Infinity, rational: null }
  }
  const rational = decimalToRational(text)
  if (!rational) throw new Error(`not a number: "${raw.trim()}"`)
  return { value: Number(text), rational }
}

/**
 * Reads a bit pattern written as binary or hex (optionally 0b/0x prefixed, spaced or underscored).
 * `prefer` breaks ties for patterns that are legal in both radixes (`1010`); an explicit 0x/0b
 * prefix always wins, except that a full-width hex pattern outranks a bogus `0b` reading —
 * `0b1999999999999a` is a real double, not a malformed binary literal.
 */
function parseBits(raw: string, precision: Precision, prefer: Format = 'breakdown'): bigint {
  const spec = SPECS[precision]
  const hexDigits = spec.width / 4
  const cleaned = raw.trim().replace(/[\s_]/g, '')
  const isBinary = (s: string) => /^[01]+$/.test(s)
  const isHex = (s: string) => /^[0-9a-fA-F]+$/.test(s)

  const read = (digits: string, radix: number): bigint => {
    const bitCount = radix === 2 ? digits.length : digits.length * 4
    if (bitCount > spec.width) {
      throw new Error(`too many bits for ${precision} (max ${spec.width}): "${raw.trim()}"`)
    }
    let out = 0n
    const base = BigInt(radix)
    for (const ch of digits) out = out * base + BigInt(Number.parseInt(ch, radix))
    return out
  }

  const hexPrefixed = /^0x(.*)$/i.exec(cleaned)
  if (hexPrefixed) {
    if (!isHex(hexPrefixed[1])) throw new Error(`invalid hex digits: "${raw.trim()}"`)
    return read(hexPrefixed[1], 16)
  }
  const binPrefixed = /^0b(.*)$/i.exec(cleaned)
  if (binPrefixed && isBinary(binPrefixed[1])) return read(binPrefixed[1], 2)
  if (cleaned.length === hexDigits && isHex(cleaned) && !isBinary(cleaned)) return read(cleaned, 16)
  if (binPrefixed) throw new Error(`invalid binary digits: "${raw.trim()}"`)

  if (prefer === 'binary' && isBinary(cleaned) && cleaned.length <= spec.width) return read(cleaned, 2)
  if (prefer === 'hex' && isHex(cleaned) && cleaned.length <= hexDigits) return read(cleaned, 16)
  if (isBinary(cleaned) && cleaned.length === spec.width) return read(cleaned, 2)
  if (isHex(cleaned) && cleaned.length <= hexDigits) return read(cleaned, 16)
  if (isBinary(cleaned)) return read(cleaned, 2)
  throw new Error(`not a ${spec.width}-bit pattern: "${raw.trim()}"`)
}

function classify(expRaw: number, mantissa: bigint, spec: Spec): Classification {
  const maxExp = (1 << spec.exponentBits) - 1
  if (expRaw === maxExp) return mantissa === 0n ? 'infinity' : 'nan'
  if (expRaw === 0) return mantissa === 0n ? 'zero' : 'subnormal'
  return 'normal'
}

function breakdown(
  bits: bigint,
  precision: Precision,
  literal: Rational | null,
  nearestDouble: number
): Record<string, unknown> {
  const spec = SPECS[precision]
  const signBit = Number((bits >> BigInt(spec.width - 1)) & 1n)
  const expRaw = Number((bits >> BigInt(spec.mantissaBits)) & ((1n << BigInt(spec.exponentBits)) - 1n))
  const mantissa = bits & ((1n << BigInt(spec.mantissaBits)) - 1n)
  const kind = classify(expRaw, mantissa, spec)
  const finite = kind !== 'nan' && kind !== 'infinity'
  const value = bitsToNumber(bits, precision)

  const allBits = bits.toString(2).padStart(spec.width, '0')
  const expBits = allBits.slice(1, 1 + spec.exponentBits)
  const mantissaBits = allBits.slice(1 + spec.exponentBits)
  const hex = `0x${bits.toString(16).padStart(spec.width / 4, '0')}`

  const sig = expRaw === 0 ? mantissa : mantissa + (1n << BigInt(spec.mantissaBits))
  const quantum = (expRaw === 0 ? 1 - spec.bias : expRaw - spec.bias) - spec.mantissaBits
  const scale = 2 ** spec.mantissaBits

  let isExact = false
  if (finite && literal) {
    let num = sig
    let den = 1n
    if (quantum >= 0) num = sig << BigInt(quantum)
    else den = 1n << BigInt(-quantum)
    if (signBit) num = -num
    isExact = rationalEquals(literal, { num, den })
  }

  return {
    precision,
    classification: kind,
    value: finite ? value : String(value),
    sign: { bit: signBit, symbol: signBit ? '-' : '+' },
    exponent: {
      bits: expBits,
      raw: expRaw,
      bias: spec.bias,
      unbiased: finite ? (expRaw === 0 ? 1 - spec.bias : expRaw - spec.bias) : null
    },
    mantissa: {
      bits: mantissaBits,
      raw: mantissa.toString(),
      hex: mantissa.toString(16).padStart(Math.ceil(spec.mantissaBits / 4), '0'),
      fraction: Number(mantissa) / scale,
      significand: finite ? Number(sig) / scale : null
    },
    bits: allBits,
    hex,
    exactValue: finite ? exactDecimal(sig, quantum, signBit === 1) : String(value),
    ulp: finite ? 2 ** quantum : null,
    isExact,
    nearestDouble: Number.isFinite(nearestDouble) ? nearestDouble : String(nearestDouble)
  }
}

const util: Utility = {
  id: 'ieee754',
  name: 'ieee 754 float bits',
  category: 'Numbers',
  description:
    'Inspect IEEE 754 floating point: turn a number into its sign/exponent/mantissa bits (binary, hex, or a full breakdown) and turn a bit pattern back into a number, in double or single precision.',
  // `format` doubles as the radix hint when decoding an ambiguous pattern such as `1010`.
  accepts: 'string',
  produces: ['string', 'json'],
  params: {
    direction: {
      kind: 'select',
      label: 'direction',
      options: ['to-bits', 'to-number'],
      default: 'to-bits'
    },
    precision: {
      kind: 'select',
      label: 'precision',
      options: ['double', 'single'],
      default: 'double'
    },
    format: {
      kind: 'select',
      label: 'format (breakdown = json; also the radix hint when decoding)',
      options: ['binary', 'hex', 'breakdown'],
      default: 'breakdown'
    }
  },
  tags: ['ieee 754', 'float bits', 'double precision', 'single precision', 'nan', 'floating point', 'float32', 'float64'],
  aliases: ['float32', 'float64'],
  examples: [
    { title: 'number to hex bits', input: '1.5', params: { direction: 'to-bits', precision: 'double', format: 'hex' }, output: '0x3ff8000000000000' },
    { title: 'hex bits to number', input: '0x3ff8000000000000', params: { direction: 'to-number', precision: 'double', format: 'hex' }, output: '1.5' }
  ],
  apply: (input: any, params: any) => {
    const raw = String(input ?? '')
    if (!raw.trim()) return ''

    const direction: Direction = params?.direction === 'to-number' ? 'to-number' : 'to-bits'
    const precision: Precision = params?.precision === 'single' ? 'single' : 'double'
    const format: Format =
      params?.format === 'binary' || params?.format === 'hex' ? params.format : 'breakdown'
    const spec = SPECS[precision]

    if (direction === 'to-bits') {
      const { value, rational } = parseLiteral(raw)
      const bits = numberToBits(value, precision)
      if (format === 'breakdown') return breakdown(bits, precision, rational, Number(value))
      if (format === 'hex') return `0x${bits.toString(16).padStart(spec.width / 4, '0')}`
      const all = bits.toString(2).padStart(spec.width, '0')
      return `${all.slice(0, 1)} ${all.slice(1, 1 + spec.exponentBits)} ${all.slice(1 + spec.exponentBits)}`
    }

    const bits = parseBits(raw, precision, format)
    const value = bitsToNumber(bits, precision)
    if (format === 'breakdown') {
      const literal = Number.isFinite(value) ? decimalToRational(showNumber(value)) : null
      return breakdown(bits, precision, literal, value)
    }
    return showNumber(value)
  }
}

export default util
