import type { Utility } from '@/types/utility'

// --- alphabets (must mirror base85_encode) ---------------------------------

const ASCII85_ALPHABET = Array.from({ length: 85 }, (_, i) => String.fromCharCode(33 + i)).join('')

const Z85_ALPHABET =
  '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ.-:+=^!/*?&<>()[]{}@%$#'

const RFC1924_ALPHABET =
  '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz!#$%&()*+-;<=>?@^_`{|}~'

const alphabetFor = (variant: string): string => {
  switch (variant) {
    case 'z85':
      return Z85_ALPHABET
    case 'rfc1924':
      return RFC1924_ALPHABET
    case 'ascii85':
      return ASCII85_ALPHABET
    default:
      throw new Error(`unknown base85 variant: ${variant}`)
  }
}

const decodeTables = new Map<string, Int16Array>()
const tableFor = (alphabet: string): Int16Array => {
  let table = decodeTables.get(alphabet)
  if (!table) {
    table = new Int16Array(128).fill(-1)
    for (let i = 0; i < alphabet.length; i++) table[alphabet.charCodeAt(i)] = i
    decodeTables.set(alphabet, table)
  }
  return table
}

const MAX32 = 4294967295

const util: Utility = {
  id: 'base85_decode',
  name: 'base85 decode',
  category: 'Decoding',
  description:
    'Decode ascii85, z85, or rfc1924 base85 to text or raw bytes, tolerating <~ ~> delimiters, whitespace, and the z zero-group shortcut.',
  accepts: 'string',
  produces: ['string', 'bytes'],
  params: {
    variant: {
      kind: 'select',
      label: 'variant',
      options: ['ascii85', 'z85', 'rfc1924'],
      default: 'ascii85'
    },
    output: { kind: 'select', label: 'output', options: ['text', 'bytes'], default: 'text' }
  },
  tags: ['base85', 'ascii85', 'z85', 'rfc1924', 'decode', 'adobe', 'binary'],
  examples: [
    {
      title: 'ascii85 with delimiters',
      input: '<~87cURD_*#TDfTZ)~>',
      output: 'Hello, world'
    }
  ],
  apply: (input: any, params: any) => {
    const variant = String(params?.variant ?? 'ascii85') || 'ascii85'
    const output = String(params?.output ?? 'text') || 'text'
    const alphabet = alphabetFor(variant)
    const table = tableFor(alphabet)

    let text = String(input ?? '').replace(/\s+/g, '')

    // '<~ ~>' are the Adobe Ascii85 delimiters. '~' is not a digit in the
    // ascii85 or z85 alphabets, so stripping a stray one there is unambiguous.
    // In rfc1924 '~' IS a digit (index 84) and '<'/'>' are digits too, so a
    // real payload can legitimately look like '000~>' or '<~000' — strip only a
    // matched pair, which is the only form the encoder ever produces.
    if (alphabet.includes('~')) {
      if (text.length >= 4 && text.startsWith('<~') && text.endsWith('~>')) {
        text = text.slice(2, -2)
      }
    } else {
      if (text.startsWith('<~')) text = text.slice(2)
      if (text.endsWith('~>')) text = text.slice(0, -2)
    }

    const out: number[] = []
    const group = new Array<number>(5)
    let count = 0

    const flushGroup = (size: number) => {
      // Pad a short tail with the highest digit, decode, then keep size-1 bytes.
      let value = 0
      for (let i = 0; i < 5; i++) {
        value = value * 85 + (i < size ? group[i] : 84)
      }
      if (value > MAX32) throw new Error('base85 group overflows 32 bits')
      const bytes = [
        Math.floor(value / 16777216) & 0xff,
        Math.floor(value / 65536) & 0xff,
        Math.floor(value / 256) & 0xff,
        value & 0xff
      ]
      const keep = size === 5 ? 4 : size - 1
      for (let i = 0; i < keep; i++) out.push(bytes[i])
    }

    for (const ch of text) {
      if (variant === 'ascii85' && (ch === 'z' || ch === 'y')) {
        if (count !== 0) throw new Error(`unexpected '${ch}' shortcut inside a base85 group`)
        const fill = ch === 'z' ? 0 : 0x20
        out.push(fill, fill, fill, fill)
        continue
      }
      const code = ch.codePointAt(0) ?? -1
      const digit = code >= 0 && code < 128 ? table[code] : -1
      if (digit < 0) throw new Error(`invalid ${variant} character: ${JSON.stringify(ch)}`)
      group[count++] = digit
      if (count === 5) {
        flushGroup(5)
        count = 0
      }
    }

    if (count === 1) throw new Error('truncated base85 data: a lone trailing character')
    if (count > 1) flushGroup(count)

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
