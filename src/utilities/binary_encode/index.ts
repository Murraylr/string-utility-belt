import type { Utility } from '@/types/utility'
import { isBytes, textToUint8Array } from '../helpers'

const ESCAPES: Record<string, string> = { n: '\n', t: '\t', r: '\r', '0': '\0', '\\': '\\' }

/** Let users type `\n` / `\t` into the single-line separator field. */
const unescapeSeparator = (raw: unknown, fallback: string): string => {
  if (raw === undefined || raw === null) return fallback
  return String(raw).replace(/\\([ntr0\\])/g, (_m, c: string) => ESCAPES[c])
}

const toBytes = (input: unknown): Uint8Array =>
  isBytes(input) ? input : textToUint8Array(String(input ?? ''))

const util: Utility = {
  id: 'binary_encode',
  name: 'binary encode',
  category: 'Encoding',
  description: 'Turn text or bytes into 0s and 1s, with 8- or 7-bit groups, a custom separator and optional multi-byte grouping.',
  accepts: ['string', 'bytes'],
  produces: 'string',
  tags: ['binary', 'bits', 'encode', 'bytes', 'base2'],
  params: {
    bits: { kind: 'select', label: 'bits per byte', options: ['8', '7'], default: '8' },
    separator: { kind: 'string', label: 'separator', default: ' ', placeholder: 'space, \\n, \\t, ...' },
    groupBytes: { kind: 'number', label: 'bytes per group (0 = no separator)', default: 1, min: 0, integer: true }
  },
  examples: [
    { title: 'one byte per group', input: 'Hi', output: '01001000 01101001' },
    { title: 'no separator', input: 'Hi', params: { separator: '', groupBytes: 0 }, output: '0100100001101001' }
  ],
  apply: (input: any, params: any = {}) => {
    const bits = Number(params?.bits ?? 8) === 7 ? 7 : 8
    const separator = unescapeSeparator(params?.separator, ' ')
    const rawGroup = Number(params?.groupBytes ?? 1)
    const groupBytes = Number.isFinite(rawGroup) ? Math.floor(rawGroup) : 1

    const bytes = toBytes(input)
    if (bytes.length === 0) return ''

    const cells: string[] = []
    for (const b of bytes) {
      if (bits === 7 && b > 0x7f) {
        throw new Error(
          `byte 0x${b.toString(16).toUpperCase().padStart(2, '0')} does not fit in 7 bits — use 8 bits`
        )
      }
      cells.push(b.toString(2).padStart(bits, '0'))
    }

    if (groupBytes < 1) return cells.join('')

    const groups: string[] = []
    for (let i = 0; i < cells.length; i += groupBytes) {
      groups.push(cells.slice(i, i + groupBytes).join(''))
    }
    return groups.join(separator)
  }
}

export default util
