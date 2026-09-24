import type { Utility } from '@/types/utility'

// Anything that is not a letter or a digit separates octal groups. A whitelist of
// punctuation is not enough: `octal_encode`'s `separator` is a free-form field, so
// `=>`, `·`, `—` and friends all have to survive the round trip. Letters and digits
// (in any script) are deliberately kept so that real junk — `9`, `x41`, `é` — still
// raises an error instead of being silently skipped.
const IS_ALNUM = /[\p{L}\p{N}]/u

const util: Utility = {
  id: 'octal_decode',
  name: 'octal decode',
  category: 'Decoding',
  description: 'Read octal byte escapes back into text or bytes, tolerating backslashes, `0o` prefixes and any separator.',
  accepts: 'string',
  produces: ['string', 'bytes'],
  tags: ['octal', 'decode', 'base8', 'escape', 'unescape', 'bytes', 'ascii'],
  params: {
    output: { kind: 'select', label: 'output', options: ['text', 'bytes'], default: 'text' }
  },
  examples: [
    { title: 'space-separated octal', input: '110 145 154 154 157', output: 'Hello' },
    {
      title: 'backslash escapes to bytes',
      input: '\\110\\145\\154\\154\\157',
      params: { output: 'bytes' },
      output: 'bytes[72, 101, 108, 108, 111]\nhex: [48, 65, 6c, 6c, 6f]\nutf8: Hello'
    }
  ],
  apply: (input: any, params: any = {}) => {
    const output = String(params?.output ?? 'text') === 'bytes' ? 'bytes' : 'text'

    // `\141`, `0o141` and `141` are all the same byte here.
    const raw = String(input ?? '')
      .replace(/\\/g, ' ')
      .replace(/0[oO](?=[0-7])/g, '')

    const values: number[] = []

    const pushToken = (token: string) => {
      const groups: string[] = []
      if (token.length <= 3) {
        groups.push(token)
      } else if (token.length % 3 === 0) {
        for (let i = 0; i < token.length; i += 3) groups.push(token.slice(i, i + 3))
      } else {
        throw new Error(`octal group "${token}" must be 1-3 digits or a multiple of 3 digits`)
      }
      for (const g of groups) {
        const v = parseInt(g, 8)
        if (v > 255) throw new Error(`octal value ${g} is larger than one byte (max 377)`)
        values.push(v)
      }
    }

    let token = ''
    for (const ch of raw) {
      if (ch >= '0' && ch <= '7') {
        token += ch
        continue
      }
      if (IS_ALNUM.test(ch)) {
        throw new Error(`invalid octal input: unexpected character "${ch}"`)
      }
      if (token) { pushToken(token); token = '' }
    }
    if (token) pushToken(token)

    if (values.length === 0) return output === 'bytes' ? new Uint8Array(0) : ''

    const bytes = Uint8Array.from(values)
    if (output === 'bytes') return bytes
    try {
      return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    } catch {
      throw new Error('decoded bytes are not valid UTF-8 — set output to bytes')
    }
  }
}

export default util
