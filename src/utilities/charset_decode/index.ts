import type { Utility, Value } from '@/types/utility'
import { isBytes } from '../helpers'

/**
 * WHATWG `windows-1252` index for the bytes 0x80-0x9F. The five "undefined"
 * slots (0x81/0x8D/0x8F/0x90/0x9D) map to the matching C1 control so the table
 * is a total, reversible 1:1 mapping of all 256 bytes.
 */
const CP1252_HIGH = [
  0x20ac, 0x0081, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021,
  0x02c6, 0x2030, 0x0160, 0x2039, 0x0152, 0x008d, 0x017d, 0x008f,
  0x0090, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014,
  0x02dc, 0x2122, 0x0161, 0x203a, 0x0153, 0x009d, 0x017e, 0x0178
]

/** iso-8859-15 (Latin-9) differs from iso-8859-1 at exactly these eight bytes. */
const LATIN9_OVERRIDES: Record<number, number> = {
  0xa4: 0x20ac, 0xa6: 0x0160, 0xa8: 0x0161, 0xb4: 0x017d,
  0xb8: 0x017e, 0xbc: 0x0152, 0xbd: 0x0153, 0xbe: 0x0178
}

/**
 * Hand-rolled because the platform `TextDecoder` is unreliable here: several
 * runtimes alias `iso-8859-1` to windows-1252, and Node aliases `windows-1252`
 * to plain Latin-1, so 0x80 decodes as U+0080 instead of the euro sign.
 */
const SINGLE_BYTE = new Set(['windows-1252', 'iso-8859-1', 'iso-8859-15'])

export function singleByteCodePoint(charset: string, byte: number): number {
  if (charset === 'iso-8859-1') return byte
  if (charset === 'iso-8859-15') return LATIN9_OVERRIDES[byte] ?? byte
  return byte >= 0x80 && byte <= 0x9f ? CP1252_HIGH[byte - 0x80] : byte
}

const CHARSETS = [
  'utf-8', 'utf-16le', 'utf-16be', 'windows-1252', 'iso-8859-1', 'iso-8859-15',
  'windows-1251', 'koi8-r', 'shift_jis', 'euc-jp', 'euc-kr', 'gbk', 'big5', 'macintosh'
]

/**
 * Bytes for the decoder. A `Uint8Array` is used as-is; a string is treated as a
 * raw byte view — every UTF-16 code unit <= 0xFF becomes one byte. That is the
 * classic mojibake repair: paste `cafÃ©`, decode as utf-8, get `café` back.
 * Code points that cannot be a byte fall back to their own UTF-8 bytes so that
 * mixed input (and astral characters) survive instead of being truncated.
 */
function toBytes(input: Value): Uint8Array {
  if (isBytes(input)) return input
  const s = String(input ?? '')
  const out: number[] = []
  const enc = new TextEncoder()
  for (let i = 0; i < s.length; i++) {
    const unit = s.charCodeAt(i)
    if (unit <= 0xff) {
      out.push(unit)
      continue
    }
    const cp = s.codePointAt(i) as number
    if (cp > 0xffff) i++
    for (const b of enc.encode(String.fromCodePoint(cp))) out.push(b)
  }
  return new Uint8Array(out)
}

const util: Utility = {
  id: 'charset_decode',
  name: 'charset decode',
  category: 'Decoding',
  description:
    'Decode bytes (or a mojibake byte-view string) into text using a legacy charset such as windows-1252, shift_jis or koi8-r, optionally failing on invalid input.',
  accepts: ['string', 'bytes'],
  produces: 'string',
  params: {
    charset: { kind: 'select', label: 'charset', options: CHARSETS, default: 'windows-1252' },
    fatal: { kind: 'boolean', label: 'error on invalid bytes', default: false }
  },
  tags: ['charset', 'encoding', 'legacy', 'windows-1252', 'shift_jis', 'koi8-r', 'mojibake', 'decode'],
  examples: [
    {
      title: 'windows-1252 accented bytes',
      input: 'e9e8',
      inputEncoding: 'hex',
      params: { charset: 'windows-1252' },
      output: 'éè'
    }
  ],
  apply: (input: any, params: any) => {
    const charset = String(params?.charset || 'windows-1252').toLowerCase()
    const fatal = params?.fatal === true
    if (!CHARSETS.includes(charset)) throw new Error(`unsupported charset: ${charset}`)

    const bytes = toBytes(input)
    if (bytes.length === 0) return ''

    if (SINGLE_BYTE.has(charset)) {
      let out = ''
      for (const b of bytes) out += String.fromCodePoint(singleByteCodePoint(charset, b))
      return out
    }

    let decoder: TextDecoder
    try {
      decoder = new TextDecoder(charset, { fatal })
    } catch {
      throw new Error(`this runtime cannot decode ${charset}`)
    }
    try {
      return decoder.decode(bytes)
    } catch {
      throw new Error(`input is not valid ${charset}`)
    }
  }
}

export default util
