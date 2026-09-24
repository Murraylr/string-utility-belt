import type { Utility } from '@/types/utility'

/**
 * Column read order: columns are visited in alphabetical order of the key's
 * characters (case-insensitive), duplicates keeping their left-to-right order.
 */
export function columnOrder(keyChars: string[]): number[] {
  return keyChars
    .map((ch, i) => ({ key: ch.toUpperCase(), i }))
    .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : a.i - b.i))
    .map((entry) => entry.i)
}

export function readKey(params: any): string[] {
  const raw: string = typeof params?.key === 'string' ? params.key : 'ZEBRA'
  const keyChars = Array.from(raw)
  if (keyChars.length === 0) throw new Error('columnar transposition requires a key')
  return keyChars
}

/** Only the first code point of the pad param is used; empty means "do not pad". */
export function readPadChar(params: any): string {
  const raw = params?.padChar
  const text = typeof raw === 'string' ? raw : 'X'
  return Array.from(text)[0] ?? ''
}

const util: Utility = {
  id: 'columnar_encode',
  name: 'columnar transposition encode',
  category: 'Ciphers',
  description:
    'Encode text with a keyed columnar transposition, reading the grid column by column in alphabetical key order and padding the last row with a pad character (leave the pad empty for ragged columns and a lossless round-trip).',
  accepts: 'string',
  produces: 'string',
  tags: ['cipher', 'encrypt', 'encode', 'transposition', 'columnar', 'classical', 'key', 'grid'],
  examples: [
    {
      title: 'encode with key ZEBRA',
      input: 'WEAREDISCOVEREDFLEEATONCE',
      params: { key: 'ZEBRA', padChar: 'X' },
      output: 'EODAEASRENEIELORCEECWDVFT'
    }
  ],
  params: {
    key: { kind: 'string', label: 'key', default: 'ZEBRA', placeholder: 'ZEBRA' },
    padChar: { kind: 'string', label: 'pad character', default: 'X' }
  },
  apply: (input: any, params: any) => {
    const chars = Array.from(String(input ?? ''))
    if (chars.length === 0) return ''

    const keyChars = readKey(params)
    const pad = readPadChar(params)
    const cols = keyChars.length

    const cells = chars.slice()
    if (pad) {
      while (cells.length % cols !== 0) cells.push(pad)
    }
    const rows = Math.ceil(cells.length / cols)

    const out: string[] = []
    for (const c of columnOrder(keyChars)) {
      for (let r = 0; r < rows; r++) {
        const i = r * cols + c
        if (i < cells.length) out.push(cells[i])
      }
    }
    return out.join('')
  }
}

export default util
