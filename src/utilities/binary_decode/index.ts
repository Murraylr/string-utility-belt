import type { Utility } from '@/types/utility'

// Anything that is not a letter or a digit separates bit groups. A whitelist of
// punctuation is not enough: `binary_encode`'s `separator` is a free-form field, so
// `=>`, `·`, `—` and friends all have to survive the round trip. Letters and digits
// (in any script) are deliberately kept so that real junk — `2`, `hello`, `é` —
// still raises an error instead of being silently skipped.
const SEPARATORS = /[^\p{L}\p{N}]+/gu

const util: Utility = {
  id: 'binary_decode',
  name: 'binary decode',
  category: 'Decoding',
  description: 'Read a string of 0s and 1s back into text or bytes, ignoring whitespace and separators, with 8- or 7-bit groups.',
  accepts: 'string',
  produces: ['string', 'bytes'],
  params: {
    bits: { kind: 'select', label: 'bits per byte', options: ['8', '7'], default: '8' },
    output: { kind: 'select', label: 'output', options: ['text', 'bytes'], default: 'text' }
  },
  tags: ['binary', 'decode', 'bits', 'bytes', '0s and 1s', 'ascii'],
  examples: [
    {
      title: '8-bit groups',
      input: '01101000 01101001',
      output: 'hi'
    }
  ],
  apply: (input: any, params: any = {}) => {
    const bits = Number(params?.bits ?? 8) === 7 ? 7 : 8
    const output = String(params?.output ?? 'text') === 'bytes' ? 'bytes' : 'text'

    const cleaned = String(input ?? '')
      .replace(/0[bB](?=[01])/g, '')
      .replace(SEPARATORS, '')

    if (cleaned.length === 0) return output === 'bytes' ? new Uint8Array(0) : ''

    // `u` flag so an astral character is reported whole, not as a broken surrogate half
    const bad = cleaned.match(/[^01]/u)
    if (bad) throw new Error(`invalid binary input: unexpected character "${bad[0]}"`)
    if (cleaned.length % bits !== 0) {
      throw new Error(`bit count ${cleaned.length} is not a multiple of ${bits}`)
    }

    const bytes = new Uint8Array(cleaned.length / bits)
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = parseInt(cleaned.slice(i * bits, i * bits + bits), 2)
    }

    if (output === 'bytes') return bytes
    try {
      return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    } catch {
      throw new Error('decoded bytes are not valid UTF-8 — set output to bytes')
    }
  }
}

export default util
