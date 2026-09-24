import type { Utility } from '@/types/utility'
import { isBytes } from '../helpers'

// RFC 4648 §5 — the URL- and filename-safe alphabet ('-' and '_' for 62/63).
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'

const toBytes = (input: unknown): Uint8Array => {
  if (isBytes(input)) return input
  return new TextEncoder().encode(input === null || input === undefined ? '' : String(input))
}

const util: Utility = {
  id: 'base64url_encode',
  name: 'base64url encode',
  category: 'Encoding',
  description:
    'Encode text or bytes as URL-safe base64 (RFC 4648 §5) using - and _, with optional = padding.',
  accepts: ['string', 'bytes'],
  produces: 'string',
  tags: ['base64', 'url-safe', 'jwt', 'encode', 'b64u'],
  aliases: ['base64url', 'jwt encode'],
  params: {
    padding: { kind: 'boolean', label: 'keep = padding', default: false }
  },
  examples: [
    { title: 'URL-safe alphabet', input: 'hello world?', output: 'aGVsbG8gd29ybGQ_' },
    { title: 'with padding', input: 'hi', params: { padding: true }, output: 'aGk=' }
  ],
  apply: (input: any, params: any) => {
    const padding = Boolean(params?.padding)
    const bytes = toBytes(input)
    if (bytes.length === 0) return ''

    let out = ''
    for (let i = 0; i < bytes.length; i += 3) {
      const remaining = bytes.length - i
      const b0 = bytes[i]
      const b1 = remaining > 1 ? bytes[i + 1] : 0
      const b2 = remaining > 2 ? bytes[i + 2] : 0

      out += ALPHABET[b0 >> 2]
      out += ALPHABET[((b0 & 0x03) << 4) | (b1 >> 4)]
      if (remaining > 1) out += ALPHABET[((b1 & 0x0f) << 2) | (b2 >> 6)]
      else if (padding) out += '='
      if (remaining > 2) out += ALPHABET[b2 & 0x3f]
      else if (padding) out += '='
    }

    return out
  }
}

export default util
