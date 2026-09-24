import type { Utility } from '@/types/utility'

type Output = 'text' | 'bytes'

const OUTPUTS: Output[] = ['text', 'bytes']
const HEX_PAIR = /^[0-9a-fA-F]{2}$/

/**
 * Decode the printable characters of a single (already de-soft-broken) line
 * into raw bytes. Characters outside ASCII are not legal quoted-printable but
 * are tolerated and re-encoded as UTF-8 so that pasted plain text survives.
 */
function decodeInto(content: string, out: number[]): void {
  const encoder = new TextEncoder()
  // Code points, so an astral character is never split into surrogate halves.
  const chars = Array.from(content)
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i]
    if (ch === '=') {
      const pair = `${chars[i + 1] ?? ''}${chars[i + 2] ?? ''}`
      if (!HEX_PAIR.test(pair)) {
        throw new Error(`invalid quoted-printable escape "=${pair}" — expected two hex digits`)
      }
      out.push(parseInt(pair, 16))
      i += 2
      continue
    }
    const cp = ch.codePointAt(0) as number
    if (cp < 0x80) out.push(cp)
    else for (const b of encoder.encode(ch)) out.push(b)
  }
}

const util: Utility = {
  id: 'quoted_printable_decode',
  name: 'quoted-printable decode',
  category: 'Decoding',
  description:
    'Decode RFC 2045 quoted-printable text, undoing =XX escapes and soft line breaks, as UTF-8 text or raw bytes.',
  accepts: 'string',
  produces: ['string', 'bytes'],
  tags: ['quoted-printable', 'qp', 'mime', 'decode', 'email', 'rfc2045'],
  aliases: ['qp decode'],
  params: {
    output: {
      kind: 'select',
      label: 'output',
      options: [...OUTPUTS],
      default: 'text'
    }
  },
  examples: [
    { title: 'hex escape', input: 'Caf=C3=A9', output: 'Café' },
    { title: 'soft line break', input: 'Line one=\r\nstill line one', output: 'Line onestill line one' }
  ],
  apply: (input: any, params: any) => {
    const output = (params?.output ?? 'text') as Output
    if (!OUTPUTS.includes(output)) throw new Error(`unknown output: ${String(output)}`)

    const s = input === null || input === undefined ? '' : String(input)
    if (!s) return output === 'bytes' ? new Uint8Array(0) : ''

    const bytes: number[] = []
    // Keep the terminators: [content, eol, content, eol, ..., content]
    const parts = s.split(/(\r\n|\n|\r)/)
    for (let p = 0; p < parts.length; p += 2) {
      // Trailing whitespace on an encoded line is transport padding (RFC 2045
      // §6.7 rule 3) — the encoder escapes any that is real.
      let content = parts[p].replace(/(?<![ \t])[ \t]+$/, '')
      const eol = parts[p + 1] ?? ''
      const soft = content.slice(-1) === '='
      if (soft) content = content.slice(0, -1)
      decodeInto(content, bytes)
      if (!soft && eol) for (let k = 0; k < eol.length; k++) bytes.push(eol.charCodeAt(k))
    }

    const buf = new Uint8Array(bytes)
    if (output === 'bytes') return buf
    try {
      return new TextDecoder('utf-8', { fatal: true }).decode(buf)
    } catch {
      throw new Error('decoded data is not valid UTF-8 text — set output to "bytes"')
    }
  }
}

export default util
