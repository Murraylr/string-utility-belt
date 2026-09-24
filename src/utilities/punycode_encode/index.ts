import type { Utility } from '@/types/utility'

/* ------------------------------------------------------------------ *
 * RFC 3492 (Punycode) — hand-rolled bootstring encoder.
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

/** True when any code point sits outside the basic (ASCII) range. */
const hasNonAscii = (s: string): boolean => {
  for (const ch of s) {
    if ((ch.codePointAt(0) as number) > 0x7f) return true
  }
  return false
}

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

/** 0-25 -> 'a'-'z', 26-35 -> '0'-'9'. */
const digitToBasic = (digit: number): string =>
  String.fromCharCode(digit < 26 ? digit + 97 : digit + 22)

/** Raw RFC 3492 encode — no `xn--` prefix, no ASCII short-circuit. */
export const punycodeEncode = (input: string): string => {
  // `Array.from` walks code points, so a well-formed pair is already a single
  // value > 0xFFFF; anything still inside the surrogate range is unpaired.
  // Encoding one would produce output our own decoder rejects, so refuse here.
  const codePoints = Array.from(input, (ch) => ch.codePointAt(0) as number)
  for (const cp of codePoints) {
    if (cp >= 0xd800 && cp <= 0xdfff) {
      const hex = cp.toString(16).toUpperCase().padStart(4, '0')
      throw new Error(`punycode: unpaired surrogate U+${hex} cannot be encoded`)
    }
  }
  const output: string[] = []

  for (const cp of codePoints) {
    if (cp < 0x80) output.push(String.fromCharCode(cp))
  }

  const basicLength = output.length
  let handled = basicLength
  if (basicLength > 0) output.push(DELIMITER)

  let n = INITIAL_N
  let bias = INITIAL_BIAS
  let delta = 0

  while (handled < codePoints.length) {
    // smallest code point >= n still waiting to be encoded
    let m = MAX_INT
    for (const cp of codePoints) {
      if (cp >= n && cp < m) m = cp
    }

    if (m - n > Math.floor((MAX_INT - delta) / (handled + 1))) {
      throw new Error('punycode: overflow while encoding')
    }
    delta += (m - n) * (handled + 1)
    n = m

    for (const cp of codePoints) {
      if (cp < n) {
        delta++
        if (delta > MAX_INT) throw new Error('punycode: overflow while encoding')
      }
      if (cp === n) {
        let q = delta
        for (let k = BASE; ; k += BASE) {
          const t = k <= bias ? TMIN : k >= bias + TMAX ? TMAX : k - bias
          if (q < t) break
          const qMinusT = q - t
          const baseMinusT = BASE - t
          output.push(digitToBasic(t + (qMinusT % baseMinusT)))
          q = Math.floor(qMinusT / baseMinusT)
        }
        output.push(digitToBasic(q))
        bias = adapt(delta, handled + 1, handled === basicLength)
        delta = 0
        handled++
      }
    }

    delta++
    n++
  }

  return output.join('')
}

/** IDNA-style: only labels holding non-ASCII get converted and `xn--` prefixed. */
export const encodeLabel = (label: string): string => {
  if (!label || !hasNonAscii(label)) return label
  if (label.slice(0, 4).toLowerCase() === 'xn--') {
    throw new Error(`punycode: label "${label}" already has an xn-- prefix but still contains non-ASCII`)
  }
  return 'xn--' + punycodeEncode(label)
}

const util: Utility = {
  id: 'punycode_encode',
  name: 'punycode encode',
  category: 'Encoding',
  description:
    'Convert Unicode to Punycode (RFC 3492), either per domain label with IDNA xn-- prefixing, as a single label, or as raw bootstring output.',
  accepts: 'string',
  produces: 'string',
  tags: ['idna', 'domain', 'dns', 'unicode', 'ascii', 'internationalized domain name', 'xn--'],
  aliases: ['idn encode'],
  examples: [
    { title: 'domain', input: 'münchen.de', output: 'xn--mnchen-3ya.de' },
    { title: 'raw bootstring', input: 'café', params: { mode: 'raw' }, output: 'caf-dma' }
  ],
  params: {
    mode: {
      kind: 'select',
      label: 'mode',
      options: ['domain', 'label', 'raw'],
      default: 'domain'
    }
  },
  apply: (input: any, { mode }: any) => {
    const s = String(input ?? '')
    if (!s) return ''
    const m = mode || 'domain'
    if (m === 'raw') return punycodeEncode(s)
    if (m === 'label') return encodeLabel(s)
    return s.split('.').map(encodeLabel).join('.')
  }
}

export default util
