import type { Utility } from '@/types/utility'
import { isBytes } from '../helpers'

// --- alphabets -------------------------------------------------------------

// Adobe / btoa Ascii85: '!' (33) .. 'u' (117)
const ASCII85_ALPHABET = Array.from({ length: 85 }, (_, i) => String.fromCharCode(33 + i)).join('')

// ZeroMQ Z85 (RFC-less but widely implemented)
const Z85_ALPHABET =
  '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ.-:+=^!/*?&<>()[]{}@%$#'

// RFC 1924 (the "IPv6 in 20 chars" alphabet)
const RFC1924_ALPHABET =
  '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz!#$%&()*+-;<=>?@^_`{|}~'

const alphabetFor = (variant: string): string => {
  switch (variant) {
    case 'z85':
      return Z85_ALPHABET
    case 'rfc1924':
      return RFC1924_ALPHABET
    case 'ascii85':
      return ASCII85_ALPHABET
    default:
      throw new Error(`unknown base85 variant: ${variant}`)
  }
}

// --- helpers ---------------------------------------------------------------

const toBytes = (input: unknown): Uint8Array => {
  if (isBytes(input)) return input
  return new TextEncoder().encode(input === null || input === undefined ? '' : String(input))
}

/** Encode one 32-bit value as exactly five base-85 digits, most significant first. */
const encodeGroup = (value: number, alphabet: string): string => {
  const digits = new Array<string>(5)
  let n = value
  for (let i = 4; i >= 0; i--) {
    digits[i] = alphabet[n % 85]
    n = Math.floor(n / 85)
  }
  return digits.join('')
}

const util: Utility = {
  id: 'base85_encode',
  name: 'base85 encode',
  category: 'Encoding',
  description:
    'Encode text or bytes as base85 using the ascii85, z85, or rfc1924 alphabet, optionally wrapped in <~ ~> delimiters.',
  accepts: ['string', 'bytes'],
  produces: 'string',
  tags: ['base85', 'ascii85', 'z85', 'rfc1924', 'encode', 'binary'],
  aliases: ['ascii85'],
  params: {
    variant: {
      kind: 'select',
      label: 'variant',
      options: ['ascii85', 'z85', 'rfc1924'],
      default: 'ascii85'
    },
    delimiters: { kind: 'boolean', label: 'wrap in <~ ~>', default: false }
  },
  examples: [
    { title: 'Ascii85', input: 'hello world', output: 'BOu!rD]j7BEbo7' },
    { title: 'Z85', input: 'hello world', params: { variant: 'z85' }, output: 'xK#0@zY<mxA+]m' }
  ],
  apply: (input: any, params: any) => {
    const variant = String(params?.variant ?? 'ascii85') || 'ascii85'
    const delimiters = Boolean(params?.delimiters)
    const alphabet = alphabetFor(variant)
    const bytes = toBytes(input)
    if (bytes.length === 0) return ''

    let out = ''
    const fullBytes = bytes.length - (bytes.length % 4)
    for (let i = 0; i < fullBytes; i += 4) {
      const value =
        bytes[i] * 16777216 + bytes[i + 1] * 65536 + bytes[i + 2] * 256 + bytes[i + 3]
      // The 'z' shortcut only exists in Ascii85 — in z85/rfc1924 'z' is a data character.
      if (value === 0 && variant === 'ascii85') {
        out += 'z'
        continue
      }
      out += encodeGroup(value, alphabet)
    }

    const rest = bytes.length - fullBytes
    if (rest > 0) {
      // Zero-pad the tail to four bytes, then keep rest+1 digits (standard Ascii85 rule,
      // applied to every variant so that inputs of any length round-trip).
      let value = 0
      for (let i = 0; i < 4; i++) {
        value = value * 256 + (i < rest ? bytes[fullBytes + i] : 0)
      }
      out += encodeGroup(value, alphabet).slice(0, rest + 1)
    }

    return delimiters ? `<~${out}~>` : out
  }
}

export default util
