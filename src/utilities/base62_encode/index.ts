import type { Utility } from '@/types/utility'

const DIGITS = '0123456789'
const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const LOWER = 'abcdefghijklmnopqrstuvwxyz'

/** `standard` is digits→upper→lower (GMP order); `inverted` swaps the two letter runs. */
const ALPHABETS: Record<string, string> = {
  standard: DIGITS + UPPER + LOWER,
  inverted: DIGITS + LOWER + UPPER
}

const isBytes = (v: any): v is Uint8Array =>
  v instanceof Uint8Array || (!!v && typeof v === 'object' && v[Symbol.toStringTag] === 'Uint8Array')

const toBytes = (input: any): Uint8Array =>
  isBytes(input) ? input : new TextEncoder().encode(input == null ? '' : String(input))

/**
 * Treats the byte string as one big-endian integer and re-expresses it in base 62.
 * Leading zero bytes have no numeric weight, so they are emitted separately as leading
 * `alphabet[0]` ("0") characters — without this the encoding would not round-trip.
 */
function base62Encode(bytes: Uint8Array, alphabet: string): string {
  let num = 0n
  for (const byte of bytes) num = (num << 8n) | BigInt(byte)

  let out = ''
  const base = BigInt(alphabet.length)
  while (num > 0n) {
    out = alphabet[Number(num % base)] + out
    num /= base
  }

  let leading = ''
  for (const byte of bytes) {
    if (byte !== 0) break
    leading += alphabet[0]
  }
  return leading + out
}

const util: Utility = {
  id: 'base62_encode',
  name: 'base62 encode',
  category: 'Encoding',
  description:
    'Encode text or bytes as Base62 (0-9A-Za-z) by treating the bytes as one big integer, with a standard or inverted (lowercase-first) alphabet.',
  accepts: ['string', 'bytes'],
  produces: 'string',
  tags: ['base62', 'encode', 'url-safe', 'shortener', 'binary', 'alphanumeric'],
  params: {
    alphabet: {
      kind: 'select',
      label: 'alphabet',
      options: ['standard', 'inverted'],
      default: 'standard'
    }
  },
  examples: [
    { title: 'standard alphabet', input: 'hello', output: '7tQLFHz' },
    { title: 'inverted alphabet', input: 'hello', params: { alphabet: 'inverted' }, output: '7TqlfhZ' }
  ],
  apply: (input: any, params: any) => {
    const name = params?.alphabet || 'standard'
    const alphabet = Object.prototype.hasOwnProperty.call(ALPHABETS, name) ? ALPHABETS[name] : undefined
    if (!alphabet) throw new Error(`unknown base62 alphabet: "${name}"`)
    return base62Encode(toBytes(input), alphabet)
  }
}

export default util
