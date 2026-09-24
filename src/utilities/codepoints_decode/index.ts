import type { Utility } from '@/types/utility'

const M_BRACE = /^\\u\{([0-9a-fA-F]+)\}$/
const M_ESCAPE = /^\\u([0-9a-fA-F]+)$/
const M_HEX_PREFIX = /^0[xX]([0-9a-fA-F]+)$/
const M_BARE = /^[0-9a-fA-F]+$/

// Everything except the characters the surviving notations are built from
// (`\u{...}`, `\uXXXX`, `0xXXXX`, bare digits) separates tokens. A whitelist of
// punctuation is not enough: `codepoints_encode`'s `separator` is a free-form field,
// so `-`, `+`, `·` and `—` all have to survive the round trip. Letters and digits are
// kept so junk still reaches the token matchers and raises a clear error.
const SPLIT = /[^\p{L}\p{N}\\{}]+/u

const MAX_CODE_POINT = 0x10ffff

const util: Utility = {
  id: 'codepoints_decode',
  name: 'from code points',
  category: 'Decoding',
  description: 'Turn a list of code points back into text, accepting U+1F600, 0x1F600, \\u{1F600}, \\uD83D\\uDE00, 1F600 and 128512 mixed together.',
  accepts: 'string',
  produces: 'string',
  params: {
    format: { kind: 'select', label: 'radix of bare numbers', options: ['auto', 'hex', 'decimal'], default: 'auto' }
  },
  tags: ['code points', 'unicode', 'decode', 'emoji', 'surrogate pairs', 'chr', 'from char code'],
  aliases: ['String.fromCodePoint'],
  examples: [
    {
      title: 'U+ notation',
      input: 'U+1F600 U+1F44D',
      output: '😀👍'
    },
    {
      title: 'hex without prefix',
      input: '0x48 0x69',
      params: { format: 'hex' },
      output: 'Hi'
    }
  ],
  apply: (input: any, params: any = {}) => {
    const rawFormat = String(params?.format ?? 'auto')
    const format = rawFormat === 'hex' || rawFormat === 'decimal' ? rawFormat : 'auto'

    // Give every notation its own whitespace so `\u{41}\u{42}` and `U+41U+42` split cleanly.
    const prepared = String(input ?? '')
      .replace(/&#[xX]/g, ' 0x')
      .replace(/&#(?=[0-9])/g, ' ')
      .replace(/\\u\{/g, ' \\u{')
      .replace(/\}/g, '} ')
      .replace(/\\u(?!\{)/g, ' \\u')
      // canonicalise `U+41` to `0x41` so `+` never has to survive the token split
      .replace(/[uU]\+/g, ' 0x')
      .replace(/0[xX](?=[0-9a-fA-F])/g, ' 0x')

    const tokens = prepared.split(SPLIT).filter(Boolean)
    if (tokens.length === 0) return ''

    const values: number[] = []

    const push = (digits: string, radix: number, token: string) => {
      const cp = parseInt(digits, radix)
      if (!Number.isFinite(cp) || Number.isNaN(cp)) {
        throw new Error(`invalid code point token "${token}"`)
      }
      if (cp > MAX_CODE_POINT) {
        throw new Error(`code point ${token} is out of range (maximum is U+10FFFF)`)
      }
      values.push(cp)
    }

    for (const token of tokens) {
      const brace = M_BRACE.exec(token)
      if (brace) { push(brace[1], 16, token); continue }

      const escaped = M_ESCAPE.exec(token)
      if (escaped) {
        const digits = escaped[1]
        // `😀` arrives as fixed-width 4-digit units; anything else is one value.
        if (digits.length > 4 && digits.length % 4 === 0) {
          for (let i = 0; i < digits.length; i += 4) push(digits.slice(i, i + 4), 16, token)
        } else {
          push(digits, 16, token)
        }
        continue
      }

      const prefixed = M_HEX_PREFIX.exec(token)
      if (prefixed) { push(prefixed[1], 16, token); continue }

      if (M_BARE.test(token)) {
        if (format === 'hex') { push(token, 16, token); continue }
        if (format === 'decimal') {
          if (!/^[0-9]+$/.test(token)) {
            throw new Error(`"${token}" is not a decimal code point — set format to hex or auto`)
          }
          push(token, 10, token)
          continue
        }
        push(token, /[a-fA-F]/.test(token) ? 16 : 10, token)
        continue
      }

      throw new Error(`invalid code point token "${token}"`)
    }

    let out = ''
    for (let i = 0; i < values.length; i++) {
      const hi = values[i]
      const lo = values[i + 1]
      if (hi >= 0xd800 && hi <= 0xdbff && lo !== undefined && lo >= 0xdc00 && lo <= 0xdfff) {
        out += String.fromCodePoint((hi - 0xd800) * 0x400 + (lo - 0xdc00) + 0x10000)
        i++
        continue
      }
      out += String.fromCodePoint(hi)
    }
    return out
  }
}

export default util
