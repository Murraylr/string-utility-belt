import type { Utility } from '@/types/utility'

/**
 * WHATWG `windows-1252` index for the bytes 0x80-0x9F. The five "undefined"
 * slots (0x81/0x8D/0x8F/0x90/0x9D) map to the matching C1 control so the table
 * is a total, reversible 1:1 mapping of all 256 bytes.
 * Kept local (rather than shared) so this utility stays self-contained; it is
 * the exact inverse of the table used by `charset_decode`.
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

function singleByteCodePoint(charset: string, byte: number): number {
  if (charset === 'iso-8859-1') return byte
  if (charset === 'iso-8859-15') return LATIN9_OVERRIDES[byte] ?? byte
  return byte >= 0x80 && byte <= 0x9f ? CP1252_HIGH[byte - 0x80] : byte
}

const reverseCache = new Map<string, Map<number, number>>()

/** code point -> byte, for the hand-rolled single-byte charsets. */
function reverseTable(charset: string): Map<number, number> {
  let table = reverseCache.get(charset)
  if (!table) {
    table = new Map<number, number>()
    for (let b = 0; b <= 0xff; b++) table.set(singleByteCodePoint(charset, b), b)
    reverseCache.set(charset, table)
  }
  return table
}

const CHARSETS = ['utf-8', 'utf-16le', 'utf-16be', 'windows-1252', 'iso-8859-1', 'iso-8859-15']
const UNMAPPABLE_MODES = ['error', 'skip', 'replace']
const REPLACEMENT = 0xfffd

function pushUtf8(out: number[], cp: number): void {
  if (cp < 0x80) out.push(cp)
  else if (cp < 0x800) out.push(0xc0 | (cp >> 6), 0x80 | (cp & 0x3f))
  else if (cp < 0x10000) out.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f))
  else out.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 0x3f), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f))
}

function pushUnit(out: number[], unit: number, little: boolean): void {
  if (little) out.push(unit & 0xff, (unit >> 8) & 0xff)
  else out.push((unit >> 8) & 0xff, unit & 0xff)
}

function pushUtf16(out: number[], cp: number, little: boolean): void {
  if (cp > 0xffff) {
    const v = cp - 0x10000
    pushUnit(out, 0xd800 + (v >> 10), little)
    pushUnit(out, 0xdc00 + (v & 0x3ff), little)
  } else {
    pushUnit(out, cp, little)
  }
}

const isLoneSurrogate = (cp: number) => cp >= 0xd800 && cp <= 0xdfff

const util: Utility = {
  id: 'charset_encode',
  name: 'charset encode',
  category: 'Encoding',
  description:
    'Encode text to raw bytes in utf-8, utf-16le/be or a single-byte charset (windows-1252, iso-8859-1, iso-8859-15), erroring, skipping or replacing characters the charset cannot represent.',
  accepts: 'string',
  produces: 'bytes',
  tags: ['charset', 'encode', 'windows-1252', 'latin1', 'iso-8859-1', 'codepage'],
  aliases: ['iconv'],
  params: {
    charset: { kind: 'select', label: 'charset', options: CHARSETS, default: 'utf-8' },
    onUnmappable: {
      kind: 'select',
      label: 'unmappable characters',
      options: UNMAPPABLE_MODES,
      default: 'error'
    }
  },
  examples: [
    {
      title: 'Latin-1',
      input: 'café',
      params: { charset: 'iso-8859-1' },
      output: 'bytes[99, 97, 102, 233]\nhex: [63, 61, 66, e9]\nutf8: caf�'
    },
    {
      title: 'windows-1252',
      input: 'café€',
      params: { charset: 'windows-1252' },
      output: 'bytes[99, 97, 102, 233, 128]\nhex: [63, 61, 66, e9, 80]\nutf8: caf�'
    }
  ],
  apply: (input: any, params: any) => {
    const charset = String(params?.charset || 'utf-8').toLowerCase()
    if (!CHARSETS.includes(charset)) throw new Error(`unsupported charset: ${charset}`)
    const onUnmappable = String(params?.onUnmappable || 'error')
    if (!UNMAPPABLE_MODES.includes(onUnmappable)) {
      throw new Error(`unknown unmappable mode: ${onUnmappable}`)
    }

    const s = String(input ?? '')
    const out: number[] = []
    const single = charset !== 'utf-8' && charset !== 'utf-16le' && charset !== 'utf-16be'
    const table = single ? reverseTable(charset) : null
    const little = charset === 'utf-16le'

    // iterate code points, never UTF-16 units, so astral characters stay whole
    for (const ch of s) {
      const cp = ch.codePointAt(0) as number
      const byte = table ? table.get(cp) : undefined
      const mappable = table ? byte !== undefined : !isLoneSurrogate(cp)

      if (mappable) {
        if (table) out.push(byte as number)
        else if (charset === 'utf-8') pushUtf8(out, cp)
        else pushUtf16(out, cp, little)
        continue
      }

      if (onUnmappable === 'error') {
        const label = `U+${cp.toString(16).toUpperCase().padStart(4, '0')}`
        throw new Error(`${label} cannot be encoded in ${charset}`)
      }
      if (onUnmappable === 'skip') continue
      if (table) out.push(0x3f) // '?'
      else if (charset === 'utf-8') pushUtf8(out, REPLACEMENT)
      else pushUtf16(out, REPLACEMENT, little)
    }

    return new Uint8Array(out)
  }
}

export default util
