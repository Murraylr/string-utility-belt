import type { Utility } from '@/types/utility'

/** RFC 4648 §6 (standard), RFC 4648 §7 (extended hex) and z-base-32 alphabets. */
const ALPHABETS: Record<string, string> = {
  'rfc4648': 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567',
  'rfc4648-hex': '0123456789ABCDEFGHIJKLMNOPQRSTUV',
  'z-base-32': 'ybndrfg8ejkmcpqxot1uwisza345h769'
}

const isBytes = (v: any): v is Uint8Array =>
  v instanceof Uint8Array || (!!v && typeof v === 'object' && v[Symbol.toStringTag] === 'Uint8Array')

const toBytes = (input: any): Uint8Array =>
  isBytes(input) ? input : new TextEncoder().encode(input == null ? '' : String(input))

/** Core 5-bit regrouping. */
function base32Encode(bytes: Uint8Array, alphabet: string, padding: boolean): string {
  let out = ''
  let value = 0
  let bits = 0
  for (const byte of bytes) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) {
      bits -= 5
      out += alphabet[(value >>> bits) & 31]
    }
    // keep only the `bits` low bits so `value` can never overflow 32 bits
    value &= (1 << bits) - 1
  }
  if (bits > 0) out += alphabet[(value << (5 - bits)) & 31]
  if (padding) while (out.length % 8 !== 0) out += '='
  return out
}

const util: Utility = {
  id: 'base32_encode',
  name: 'base32 encode',
  category: 'Encoding',
  description:
    'Encode text or bytes as Base32 using the RFC 4648, RFC 4648 extended-hex, or z-base-32 alphabet, with optional "=" padding.',
  accepts: ['string', 'bytes'],
  produces: 'string',
  tags: ['base32', 'encode', 'rfc4648', 'z-base-32', 'totp', 'binary'],
  aliases: ['b32encode'],
  params: {
    variant: {
      kind: 'select',
      label: 'variant',
      options: ['rfc4648', 'rfc4648-hex', 'z-base-32'],
      default: 'rfc4648'
    },
    padding: { kind: 'boolean', label: 'padding', default: true }
  },
  examples: [
    { title: 'RFC 4648', input: 'hello', output: 'NBSWY3DP' },
    { title: 'z-base-32, no padding', input: 'hello', params: { variant: 'z-base-32', padding: false }, output: 'pb1sa5dx' }
  ],
  apply: (input: any, params: any) => {
    const variant = params?.variant || 'rfc4648'
    const alphabet = Object.prototype.hasOwnProperty.call(ALPHABETS, variant) ? ALPHABETS[variant] : undefined
    if (!alphabet) throw new Error(`unknown base32 variant: "${variant}"`)
    const padding = params?.padding !== false
    return base32Encode(toBytes(input), alphabet, padding)
  }
}

export default util
