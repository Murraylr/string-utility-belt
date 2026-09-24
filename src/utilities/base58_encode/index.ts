import type { Utility } from '@/types/utility'

/** All three alphabets omit visually ambiguous characters; they differ only in ordering. */
const ALPHABETS: Record<string, string> = {
  bitcoin: '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz',
  ripple: 'rpshnaf39wBUDNEGHJKLM4PQRST7VWXYZ2bcdeCg65jkm8oFqi1tuvAxyz',
  flickr: '123456789abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ'
}

const isBytes = (v: any): v is Uint8Array =>
  v instanceof Uint8Array || (!!v && typeof v === 'object' && v[Symbol.toStringTag] === 'Uint8Array')

const toBytes = (input: any): Uint8Array =>
  isBytes(input) ? input : new TextEncoder().encode(input == null ? '' : String(input))

/**
 * Big-integer base conversion. Leading zero bytes carry no numeric weight, so they are
 * emitted separately as leading `alphabet[0]` characters (the Bitcoin "1" convention);
 * this is what makes the encoding losslessly reversible.
 */
function base58Encode(bytes: Uint8Array, alphabet: string): string {
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
  id: 'base58_encode',
  name: 'base58 encode',
  category: 'Encoding',
  description:
    'Encode text or bytes as Base58 using the Bitcoin, Ripple, or Flickr alphabet, preserving leading zero bytes as leading zero-digit characters.',
  accepts: ['string', 'bytes'],
  produces: 'string',
  tags: ['base58', 'encode', 'bitcoin', 'ripple', 'flickr', 'binary'],
  params: {
    alphabet: {
      kind: 'select',
      label: 'alphabet',
      options: ['bitcoin', 'ripple', 'flickr'],
      default: 'bitcoin'
    }
  },
  examples: [
    { title: 'Bitcoin alphabet', input: 'hello world', output: 'StV1DL6CwTryKyV' },
    {
      title: 'leading zero bytes',
      input: '00010203',
      inputEncoding: 'hex',
      params: { alphabet: 'bitcoin' },
      output: '1Ldp'
    }
  ],
  apply: (input: any, params: any) => {
    const name = params?.alphabet || 'bitcoin'
    const alphabet = Object.prototype.hasOwnProperty.call(ALPHABETS, name) ? ALPHABETS[name] : undefined
    if (!alphabet) throw new Error(`unknown base58 alphabet: "${name}"`)
    return base58Encode(toBytes(input), alphabet)
  }
}

export default util
