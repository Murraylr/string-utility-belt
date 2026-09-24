import type { Utility } from '@/types/utility'
import { isBytes } from '../helpers'

// basE91 alphabet (Joachim Henke) — 91 printable ASCII characters, excluding
// space, '-', '\'' and '\\' so the output is safe inside single-quoted strings.
const ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!#$%&()*+,./:;<=>?@[]^_`{|}~"'

const toBytes = (input: unknown): Uint8Array => {
  if (isBytes(input)) return input
  return new TextEncoder().encode(input === null || input === undefined ? '' : String(input))
}

const util: Utility = {
  id: 'base91_encode',
  name: 'basE91 encode',
  category: 'Encoding',
  description: 'Encode text or bytes as basE91, a denser printable-ASCII alternative to base64.',
  accepts: ['string', 'bytes'],
  produces: 'string',
  tags: ['base91', 'encode', 'binary', 'dense'],
  params: {},
  examples: [
    { title: 'plain text', input: 'hello world', output: 'TPwJh>Io2Tv!lE' }
  ],
  apply: (input: any) => {
    const bytes = toBytes(input)
    if (bytes.length === 0) return ''

    let out = ''
    let queue = 0
    let bits = 0

    for (let i = 0; i < bytes.length; i++) {
      queue |= bytes[i] << bits
      bits += 8
      if (bits > 13) {
        let value = queue & 8191
        if (value > 88) {
          queue >>>= 13
          bits -= 13
        } else {
          value = queue & 16383
          queue >>>= 14
          bits -= 14
        }
        out += ALPHABET[value % 91] + ALPHABET[Math.floor(value / 91)]
      }
    }

    if (bits > 0) {
      out += ALPHABET[queue % 91]
      if (bits > 7 || queue > 90) out += ALPHABET[Math.floor(queue / 91)]
    }

    return out
  }
}

export default util
