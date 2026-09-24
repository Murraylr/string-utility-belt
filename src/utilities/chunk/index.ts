import type { Utility } from '@/types/utility'

/**
 * A single-line text input cannot hold a real newline or tab, so the separator and
 * pad-character params accept the usual backslash escapes. `\\n` yields a literal `\n`.
 */
const decodeEscapes = (raw: string) =>
  raw.replace(/\\(n|r|t|0|\\)/g, (_m, c: string) =>
    c === 'n' ? '\n' : c === 'r' ? '\r' : c === 't' ? '\t' : c === '0' ? '\0' : '\\')

/**
 * A cleared number field in the params editor arrives as `''`, and `Number('')` is 0 —
 * so read numbers through this to fall back to the declared default instead. Genuine
 * garbage (`'nope'`) still becomes NaN and is rejected by the caller.
 */
const numberParam = (v: unknown, fallback: number) =>
  v === undefined || v === null || v === '' ? fallback : Number(v)

const toBool = (v: unknown, fallback: boolean) => {
  if (v === undefined || v === null || v === '') return fallback
  if (typeof v === 'string') return v !== 'false' && v !== '0'
  return Boolean(v)
}

const splitUnits = (s: string, unit: string): string[] => {
  if (unit === 'characters') return Array.from(s) // code points, so emoji stay whole
  if (unit === 'words') return s.match(/\S+/gu) ?? []
  if (unit === 'lines') {
    const lines = s.split(/\r\n|\r|\n/)
    // A trailing newline is a terminator, not an empty final line.
    if (lines.length > 1 && lines[lines.length - 1] === '') lines.pop()
    return lines
  }
  throw new Error(`unknown unit: ${unit}`)
}

const JOINERS: Record<string, string> = { characters: '', words: ' ', lines: '\n' }

const util: Utility = {
  id: 'chunk',
  name: 'chunk',
  category: 'String Ops',
  description:
    'Split the text into fixed-size groups of characters, words, or lines joined by a separator, optionally padding the final group.',
  accepts: 'string',
  produces: 'string',
  params: {
    size: { kind: 'number', label: 'chunk size', default: 10, min: 1, integer: true },
    unit: { kind: 'select', label: 'unit', options: ['characters', 'words', 'lines'], default: 'characters' },
    separator: { kind: 'string', label: 'separator', default: '\n' },
    padLast: { kind: 'boolean', label: 'pad last chunk', default: false },
    padChar: { kind: 'string', label: 'pad character', default: ' ' }
  },
  tags: ['split into groups', 'fixed size chunks', 'batch text', 'group characters', 'wrap text'],
  examples: [
    { title: 'chunk characters', input: 'abcdefgh', params: { size: 3, unit: 'characters', separator: '-' }, output: 'abc-def-gh' }
  ],
  apply: (input: any, { size, unit, separator, padLast, padChar }: any) => {
    const s = String(input)
    if (s === '') return ''

    const n = Math.trunc(numberParam(size, 10))
    if (!Number.isFinite(n) || n < 1) throw new Error('chunk size must be a whole number of at least 1')

    const mode = unit || 'characters'
    const units = splitUnits(s, mode)
    const sep = decodeEscapes(String(separator ?? '\n'))
    const pad = toBool(padLast, false)
    const rawPad = decodeEscapes(String(padChar ?? ' '))
    const padUnits = mode === 'characters' ? Array.from(rawPad || ' ') : [rawPad || ' ']

    const chunks: string[] = []
    for (let i = 0; i < units.length; i += n) {
      const group = units.slice(i, i + n)
      if (pad && group.length < n) {
        let k = 0
        while (group.length < n) group.push(padUnits[k++ % padUnits.length])
      }
      chunks.push(group.join(JOINERS[mode]))
    }
    return chunks.join(sep)
  }
}

export default util
