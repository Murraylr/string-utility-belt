import type { Utility } from '@/types/utility'

// basE91 alphabet (Joachim Henke) — must mirror base91_encode.
const ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!#$%&()*+,./:;<=>?@[]^_`{|}~"'

const TABLE = (() => {
  const t = new Int16Array(128).fill(-1)
  for (let i = 0; i < ALPHABET.length; i++) t[ALPHABET.charCodeAt(i)] = i
  return t
})()

const util: Utility = {
  id: 'base91_decode',
  name: 'basE91 decode',
  category: 'Decoding',
  description: 'Decode basE91 text back to UTF-8 text or raw bytes, ignoring line breaks.',
  accepts: 'string',
  produces: ['string', 'bytes'],
  params: {
    output: { kind: 'select', label: 'output', options: ['text', 'bytes'], default: 'text' }
  },
  tags: ['base91', 'decode', 'binary', 'compact encoding'],
  examples: [
    {
      title: 'decode text',
      input: '"ONK;WeMB2Q',
      output: 'Test 123!'
    }
  ],
  apply: (input: any, params: any) => {
    const output = String(params?.output ?? 'text') || 'text'
    const text = String(input ?? '').replace(/\s+/g, '')

    const out: number[] = []
    let value = -1
    let queue = 0
    let bits = 0

    for (const ch of text) {
      const code = ch.codePointAt(0) ?? -1
      const digit = code >= 0 && code < 128 ? TABLE[code] : -1
      if (digit < 0) throw new Error(`invalid basE91 character: ${JSON.stringify(ch)}`)
      if (value < 0) {
        value = digit
        continue
      }
      value += digit * 91
      queue |= value << bits
      bits += (value & 8191) > 88 ? 13 : 14
      do {
        out.push(queue & 0xff)
        queue >>>= 8
        bits -= 8
      } while (bits > 7)
      value = -1
    }

    if (value >= 0) out.push((queue | (value << bits)) & 0xff)

    const bytes = Uint8Array.from(out)
    if (output === 'bytes') return bytes
    try {
      return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    } catch {
      throw new Error('decoded data is not valid UTF-8 text — set output to bytes')
    }
  }
}

export default util
