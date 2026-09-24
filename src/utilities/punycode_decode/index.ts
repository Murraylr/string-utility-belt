import type { Utility } from '@/types/utility'

/* ------------------------------------------------------------------ *
 * RFC 3492 (Punycode) — hand-rolled bootstring decoder.
 * Deliberately not the deprecated node `punycode` module.
 * ------------------------------------------------------------------ */

const BASE = 36
const TMIN = 1
const TMAX = 26
const SKEW = 38
const DAMP = 700
const INITIAL_BIAS = 72
const INITIAL_N = 128
const DELIMITER = '-'
const MAX_INT = 0x7fffffff

/** Bias adaptation, RFC 3492 §6.1. All divisions are integer divisions. */
const adapt = (delta: number, numPoints: number, firstTime: boolean): number => {
  let d = firstTime ? Math.floor(delta / DAMP) : Math.floor(delta / 2)
  d += Math.floor(d / numPoints)
  let k = 0
  while (d > Math.floor(((BASE - TMIN) * TMAX) / 2)) {
    d = Math.floor(d / (BASE - TMIN))
    k += BASE
  }
  return k + Math.floor(((BASE - TMIN + 1) * d) / (d + SKEW))
}

/** 'a'-'z'/'A'-'Z' -> 0-25, '0'-'9' -> 26-35, anything else -> BASE (invalid). */
const basicToDigit = (code: number): number => {
  if (code >= 0x30 && code < 0x3a) return 26 + (code - 0x30)
  if (code >= 0x41 && code < 0x5b) return code - 0x41
  if (code >= 0x61 && code < 0x7b) return code - 0x61
  return BASE
}

/** Raw RFC 3492 decode — expects bootstring text with no `xn--` prefix. */
export const punycodeDecode = (input: string): string => {
  const output: number[] = []
  const length = input.length

  let i = 0
  let n = INITIAL_N
  let bias = INITIAL_BIAS

  // Everything before the LAST delimiter is copied verbatim.
  let basic = input.lastIndexOf(DELIMITER)
  if (basic < 0) basic = 0

  for (let j = 0; j < basic; j++) {
    const code = input.charCodeAt(j)
    if (code >= 0x80) {
      throw new Error('punycode: non-ASCII character in the literal portion')
    }
    output.push(code)
  }

  for (let index = basic > 0 ? basic + 1 : 0; index < length; ) {
    const oldi = i
    for (let w = 1, k = BASE; ; k += BASE) {
      if (index >= length) throw new Error('punycode: truncated input')
      const ch = input.charAt(index)
      const digit = basicToDigit(input.charCodeAt(index))
      index++
      if (digit >= BASE) throw new Error(`punycode: invalid digit "${ch}"`)
      if (digit > Math.floor((MAX_INT - i) / w)) {
        throw new Error('punycode: overflow while decoding')
      }
      i += digit * w
      const t = k <= bias ? TMIN : k >= bias + TMAX ? TMAX : k - bias
      if (digit < t) break
      const baseMinusT = BASE - t
      if (w > Math.floor(MAX_INT / baseMinusT)) {
        throw new Error('punycode: overflow while decoding')
      }
      w *= baseMinusT
    }

    const out = output.length + 1
    bias = adapt(i - oldi, out, oldi === 0)

    if (Math.floor(i / out) > MAX_INT - n) {
      throw new Error('punycode: overflow while decoding')
    }
    n += Math.floor(i / out)
    i %= out

    if (n < 0 || n > 0x10ffff || (n >= 0xd800 && n <= 0xdfff)) {
      throw new Error(`punycode: decoded an invalid code point (${n})`)
    }

    output.splice(i, 0, n)
    i++
  }

  return output.map((cp) => String.fromCodePoint(cp)).join('')
}

/** Undo IDNA labelling: `xn--` prefixed labels are decoded, others pass through. */
export const decodeLabel = (label: string): string => {
  if (label.length > 4 && label.slice(0, 4).toLowerCase() === 'xn--') {
    return punycodeDecode(label.slice(4))
  }
  return label
}

const util: Utility = {
  id: 'punycode_decode',
  name: 'punycode decode',
  category: 'Decoding',
  description:
    'Convert Punycode back to Unicode (RFC 3492), either per xn-- prefixed domain label, as a single label, or as raw bootstring text.',
  accepts: 'string',
  produces: 'string',
  tags: ['punycode', 'idna', 'domain', 'unicode', 'decode', 'xn--', 'dns'],
  aliases: ['idna decode'],
  params: {
    mode: {
      kind: 'select',
      label: 'mode',
      options: ['domain', 'label', 'raw'],
      default: 'domain'
    }
  },
  examples: [
    { title: 'single label', input: 'xn--nxasmq6b', params: { mode: 'label' }, output: 'βόλοσ' },
    { title: 'whole domain', input: 'xn--nxasmq6b.example.com', output: 'βόλοσ.example.com' },
    { title: 'raw bootstring', input: '4can8av2009b', params: { mode: 'raw' }, output: 'üëäö♥' }
  ],
  apply: (input: any, { mode }: any) => {
    const s = String(input ?? '')
    if (!s) return ''
    const m = mode || 'domain'
    if (m === 'raw') return punycodeDecode(s)
    if (m === 'label') return decodeLabel(s)
    return s.split('.').map(decodeLabel).join('.')
  }
}

export default util
