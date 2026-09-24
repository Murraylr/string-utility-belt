import type { Utility } from '@/types/utility'

/**
 * Column read order: columns are visited in alphabetical order of the key's
 * characters (case-insensitive), duplicates keeping their left-to-right order.
 */
function columnOrder(keyChars: string[]): number[] {
  return keyChars
    .map((ch, i) => ({ key: ch.toUpperCase(), i }))
    .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : a.i - b.i))
    .map((entry) => entry.i)
}

function readKey(params: any): string[] {
  const raw: string = typeof params?.key === 'string' ? params.key : 'ZEBRA'
  const keyChars = Array.from(raw)
  if (keyChars.length === 0) throw new Error('columnar transposition requires a key')
  return keyChars
}

/** Only the first code point of the pad param is used; empty means "strip nothing". */
function readPadChar(params: any): string {
  const raw = params?.padChar
  const text = typeof raw === 'string' ? raw : 'X'
  return Array.from(text)[0] ?? ''
}

const util: Utility = {
  id: 'columnar_decode',
  name: 'columnar transposition decode',
  category: 'Ciphers',
  description:
    'Decode a keyed columnar transposition by rebuilding the grid from the alphabetical key order, then stripping trailing pad characters (leave the pad empty for an exact round-trip of text that may itself end in the pad character).',
  accepts: 'string',
  produces: 'string',
  tags: ['cipher', 'decrypt', 'decode', 'transposition', 'columnar', 'classical', 'key', 'grid'],
  examples: [
    {
      title: 'round trip with key ZEBRA',
      input: 'EODAEASRENEIELORCEECWDVFT',
      params: { key: 'ZEBRA', padChar: 'X' },
      output: 'WEAREDISCOVEREDFLEEATONCE'
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
    const n = chars.length

    // With a row-major fill the last row may be short, so the leftmost
    // `n % cols` columns hold one extra character than the rest.
    const base = Math.floor(n / cols)
    const extra = n % cols

    const grid: string[] = new Array(n)
    let p = 0
    for (const c of columnOrder(keyChars)) {
      const height = base + (c < extra ? 1 : 0)
      for (let r = 0; r < height; r++) grid[r * cols + c] = chars[p++]
    }

    // The encoder pads only the final row, so at most cols-1 characters were added.
    let end = n
    if (pad && extra === 0) {
      let removed = 0
      while (end > 0 && removed < cols - 1 && grid[end - 1] === pad) {
        end--
        removed++
      }
    }
    return grid.slice(0, end).join('')
  }
}

export default util
