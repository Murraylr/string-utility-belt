import type { Utility } from '@/types/utility'

const ALPHABETS: Record<string, string> = {
  'rfc4648': 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567',
  'rfc4648-hex': '0123456789ABCDEFGHIJKLMNOPQRSTUV',
  'z-base-32': 'ybndrfg8ejkmcpqxot1uwisza345h769'
}

/** Case-insensitive lookup tables, built once per variant. */
const MAPS: Record<string, Map<string, number>> = {}
function lookupFor(variant: string): Map<string, number> {
  const alphabet = Object.prototype.hasOwnProperty.call(ALPHABETS, variant) ? ALPHABETS[variant] : undefined
  if (!alphabet) throw new Error(`unknown base32 variant: "${variant}"`)
  let map = MAPS[variant]
  if (!map) {
    map = new Map<string, number>()
    for (let i = 0; i < alphabet.length; i++) {
      map.set(alphabet[i].toUpperCase(), i)
      map.set(alphabet[i].toLowerCase(), i)
    }
    MAPS[variant] = map
  }
  return map
}

const isBytes = (v: any): v is Uint8Array =>
  v instanceof Uint8Array || (!!v && typeof v === 'object' && v[Symbol.toStringTag] === 'Uint8Array')

const toText = (input: any): string =>
  isBytes(input) ? new TextDecoder().decode(input) : input == null ? '' : String(input)

/** Character counts that no valid Base32 group can produce. */
const BAD_REMAINDERS = new Set([1, 3, 6])

/** Core 5-bit → 8-bit regrouping. */
function base32Decode(text: string, lookup: Map<string, number>): Uint8Array {
  const clean = text.replace(/[\s=]+/g, '')
  if (!clean) return new Uint8Array(0)

  const out: number[] = []
  let value = 0
  let bits = 0
  // Characters are validated first so a typo is reported as the bad character it is,
  // rather than as a length problem it merely happens to also cause.
  for (const ch of clean) {
    const idx = lookup.get(ch)
    if (idx === undefined) throw new Error(`invalid base32 character: "${ch}"`)
    value = (value << 5) | idx
    bits += 5
    if (bits >= 8) {
      bits -= 8
      out.push((value >>> bits) & 0xff)
      value &= (1 << bits) - 1
    }
  }
  if (BAD_REMAINDERS.has(clean.length % 8)) {
    throw new Error(`invalid base32 length: ${clean.length} characters is not a valid group size`)
  }
  // RFC 4648 §3.5: the bits left over from the final character are pad bits and must be zero.
  // `value` now holds exactly those leftover bits. Accepting non-zero pad bits would silently
  // turn a single-character typo ("MZ" instead of "MY") into plausible-looking wrong output.
  if (value !== 0) {
    throw new Error(
      'invalid base32: non-canonical encoding — the unused trailing bits of the last character are not zero'
    )
  }
  return new Uint8Array(out)
}

const util: Utility = {
  id: 'base32_decode',
  name: 'base32 decode',
  category: 'Decoding',
  description:
    'Decode Base32 (RFC 4648, extended-hex, or z-base-32) to text or raw bytes, ignoring case, whitespace, and missing padding.',
  accepts: 'string',
  produces: ['string', 'bytes'],
  params: {
    variant: {
      kind: 'select',
      label: 'variant',
      options: ['rfc4648', 'rfc4648-hex', 'z-base-32'],
      default: 'rfc4648'
    },
    output: { kind: 'select', label: 'output', options: ['text', 'bytes'], default: 'text' }
  },
  tags: ['base32', 'decode', 'rfc4648', 'z-base-32', 'binary', 'totp'],
  examples: [
    {
      title: 'rfc 4648',
      input: 'NBSWY3DP',
      output: 'hello'
    },
    {
      title: 'longer text',
      input: 'NBSWY3DPO5XXE3DE',
      params: { variant: 'rfc4648' },
      output: 'helloworld'
    }
  ],
  apply: (input: any, params: any) => {
    const lookup = lookupFor(params?.variant || 'rfc4648')
    const bytes = base32Decode(toText(input), lookup)
    if ((params?.output || 'text') === 'bytes') return bytes
    if (bytes.length === 0) return ''
    try {
      return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    } catch {
      throw new Error('decoded bytes are not valid UTF-8 text — set output to "bytes"')
    }
  }
}

export default util
