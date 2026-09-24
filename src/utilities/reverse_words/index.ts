import type { Utility } from '@/types/utility'

// Text params are single-line inputs, so allow the usual backslash escapes to
// reach otherwise untypeable separators (tab, newline). `\\` escapes a backslash.
const ESCAPES: Record<string, string> = { n: '\n', r: '\r', t: '\t', '\\': '\\' }
const decodeEscapes = (s: string) => s.replace(/\\([nrt\\])/g, (m, c: string) => ESCAPES[c] ?? m)

// Split on '\n' but keep any '\r' where it was, so CRLF text survives round-trips.
const mapLines = (s: string, fn: (line: string) => string) =>
  s
    .split('\n')
    .map((raw) => {
      const hasCr = raw.length > 0 && raw.charCodeAt(raw.length - 1) === 13
      const body = hasCr ? raw.slice(0, -1) : raw
      return fn(body) + (hasCr ? '\r' : '')
    })
    .join('\n')

// Splitting on a literal separator never lands inside a surrogate pair, so
// astral characters (emoji) stay intact.
const reverseOn = (text: string, separator: string) => text.split(separator).reverse().join(separator)

const util: Utility = {
  id: 'reverse_words',
  name: 'reverse word order',
  category: 'String Ops',
  description:
    'Reverse the order of words, splitting on a custom separator, either within each line or across the whole text.',
  accepts: 'string',
  produces: 'string',
  tags: ['reverse words', 'word order', 'flip word order', 'shuffle order'],
  examples: [
    { title: 'reverse word order per line', input: 'the quick brown fox', output: 'fox brown quick the' }
  ],
  params: {
    separator: {
      kind: 'string',
      label: 'separator',
      default: ' ',
      placeholder: 'space — \\n, \\r and \\t are understood'
    },
    perLine: { kind: 'boolean', label: 'per line', default: true }
  },
  apply: (input: any, { separator: _separator, perLine: _perLine }: any) => {
    const s = String(input ?? '')
    if (s === '') return ''

    const separator = decodeEscapes(_separator === undefined || _separator === null ? ' ' : String(_separator))
    if (separator === '') throw new Error('reverse words: separator must not be empty')

    const perLine = _perLine === undefined ? true : Boolean(_perLine)
    return perLine ? mapLines(s, (line) => reverseOn(line, separator)) : reverseOn(s, separator)
  }
}

export default util
