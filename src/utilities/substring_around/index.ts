import type { Utility } from '@/types/utility'

const ESCAPES: Record<string, string> = { n: '\n', r: '\r', t: '\t', '\\': '\\' }
const decodeEscapes = (s: string) => s.replace(/\\([nrt\\])/g, (m, c: string) => ESCAPES[c] ?? m)

const mapLines = (s: string, fn: (line: string, index: number) => string) =>
  s
    .split('\n')
    .map((raw, i) => {
      const hasCr = raw.length > 0 && raw.charCodeAt(raw.length - 1) === 13
      const body = hasCr ? raw.slice(0, -1) : raw
      return fn(body, i) + (hasCr ? '\r' : '')
    })
    .join('\n')

const MISSING = Symbol('not found')

type Cut = string | typeof MISSING

// All slicing happens at delimiter boundaries found by indexOf/lastIndexOf, so a
// surrogate pair can never be split apart: emoji delimiters and emoji content
// both survive.
function cut(
  line: string,
  delimiter: string,
  endDelimiter: string,
  mode: string,
  last: boolean
): Cut {
  if (mode === 'before') {
    const at = last ? line.lastIndexOf(delimiter) : line.indexOf(delimiter)
    return at < 0 ? MISSING : line.slice(0, at)
  }

  if (mode === 'after') {
    const at = last ? line.lastIndexOf(delimiter) : line.indexOf(delimiter)
    return at < 0 ? MISSING : line.slice(at + delimiter.length)
  }

  // between
  if (last) {
    const end = line.lastIndexOf(endDelimiter)
    if (end < 0) return MISSING
    const start = end - delimiter.length < 0 ? -1 : line.lastIndexOf(delimiter, end - delimiter.length)
    if (start < 0 || start + delimiter.length > end) return MISSING
    return line.slice(start + delimiter.length, end)
  }
  const start = line.indexOf(delimiter)
  if (start < 0) return MISSING
  const from = start + delimiter.length
  const end = line.indexOf(endDelimiter, from)
  if (end < 0) return MISSING
  return line.slice(from, end)
}

const util: Utility = {
  id: 'substring_around',
  name: 'substring before / after',
  category: 'String Ops',
  description:
    'Keep the text before, after, or between delimiters, matching the first or last occurrence, over the whole input or line by line.',
  accepts: 'string',
  produces: 'string',
  tags: ['before and after', 'delimiter extraction', 'substring between', 'split around', 'cut string'],
  examples: [
    { title: 'domain after @', input: 'user@example.com', params: { delimiter: '@', mode: 'after', endDelimiter: '', occurrence: 'first', perLine: false, ifMissing: 'whole' }, output: 'example.com' }
  ],
  params: {
    delimiter: {
      kind: 'string',
      label: 'delimiter',
      default: '',
      placeholder: 'e.g. @ or :  — \\n and \\t are understood'
    },
    mode: { kind: 'select', label: 'mode', options: ['before', 'after', 'between'], default: 'before' },
    endDelimiter: {
      kind: 'string',
      label: 'end delimiter',
      default: '',
      placeholder: 'between mode — empty reuses the delimiter'
    },
    occurrence: { kind: 'select', label: 'occurrence', options: ['first', 'last'], default: 'first' },
    perLine: { kind: 'boolean', label: 'per line', default: false },
    ifMissing: {
      kind: 'select',
      label: 'if not found',
      options: ['empty', 'whole', 'error'],
      default: 'whole'
    }
  },
  apply: (
    input: any,
    {
      delimiter: _delimiter,
      mode: _mode,
      endDelimiter: _endDelimiter,
      occurrence: _occurrence,
      perLine: _perLine,
      ifMissing: _ifMissing
    }: any
  ) => {
    const s = String(input ?? '')
    if (s === '') return ''

    const delimiter = decodeEscapes(_delimiter === undefined || _delimiter === null ? '' : String(_delimiter))
    if (delimiter === '') throw new Error('substring around: a delimiter is required')

    const mode = _mode === 'after' || _mode === 'between' ? _mode : 'before'
    const rawEnd = decodeEscapes(
      _endDelimiter === undefined || _endDelimiter === null ? '' : String(_endDelimiter)
    )
    // An empty end delimiter means "the same marker on both sides" — handy for
    // pulling the text out of "quoted" spans.
    const endDelimiter = rawEnd === '' ? delimiter : rawEnd
    const last = _occurrence === 'last'
    const perLine = Boolean(_perLine)
    const ifMissing = _ifMissing === 'empty' || _ifMissing === 'error' ? _ifMissing : 'whole'

    const resolve = (line: string, index: number) => {
      const result = cut(line, delimiter, endDelimiter, mode, last)
      if (result !== MISSING) return result
      if (ifMissing === 'empty') return ''
      if (ifMissing === 'whole') return line
      const where = perLine ? ` on line ${index + 1}` : ''
      throw new Error(`substring around: ${JSON.stringify(delimiter)} not found${where}`)
    }

    return perLine ? mapLines(s, resolve) : resolve(s, 0)
  }
}

export default util
