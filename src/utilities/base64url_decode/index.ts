import type { Utility } from '@/types/utility'

const STANDARD = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

// Accepts both the URL-safe ('-', '_') and the standard ('+', '/') alphabets.
const TABLE = (() => {
  const t = new Int16Array(128).fill(-1)
  for (let i = 0; i < STANDARD.length; i++) t[STANDARD.charCodeAt(i)] = i
  t['-'.charCodeAt(0)] = 62
  t['_'.charCodeAt(0)] = 63
  return t
})()

const util: Utility = {
  id: 'base64url_decode',
  name: 'base64url decode',
  category: 'Decoding',
  description:
    'Decode URL-safe or standard base64 to text or raw bytes, tolerating missing padding and whitespace.',
  accepts: 'string',
  produces: ['string', 'bytes'],
  params: {
    output: { kind: 'select', label: 'output', options: ['text', 'bytes'], default: 'text' }
  },
  tags: ['base64url', 'decode', 'url safe', 'jwt', 'binary', 'atob'],
  examples: [
    {
      title: 'url-safe characters',
      input: 'aGVsbG8_d29ybGQ',
      output: 'hello?world'
    }
  ],
  apply: (input: any, params: any) => {
    const output = String(params?.output ?? 'text') || 'text'
    const text = String(input ?? '')
      .replace(/\s+/g, '')
      .replace(/(?<!=)=+$/, '')

    const digits: number[] = []
    for (const ch of text) {
      const code = ch.codePointAt(0) ?? -1
      const digit = code >= 0 && code < 128 ? TABLE[code] : -1
      if (digit < 0) throw new Error(`invalid base64url character: ${JSON.stringify(ch)}`)
      digits.push(digit)
    }

    if (digits.length % 4 === 1) {
      throw new Error('invalid base64url length: a lone trailing character')
    }

    const out: number[] = []
    for (let i = 0; i < digits.length; i += 4) {
      const remaining = digits.length - i
      const d0 = digits[i]
      const d1 = digits[i + 1]
      const d2 = remaining > 2 ? digits[i + 2] : 0
      const d3 = remaining > 3 ? digits[i + 3] : 0

      out.push(((d0 << 2) | (d1 >> 4)) & 0xff)
      if (remaining > 2) out.push((((d1 & 0x0f) << 4) | (d2 >> 2)) & 0xff)
      if (remaining > 3) out.push((((d2 & 0x03) << 6) | d3) & 0xff)
    }

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
