import type { Utility } from '@/types/utility'

const ESCAPES: Record<string, string> = { n: '\n', r: '\r', t: '\t', '\\': '\\' }
const decodeEscapes = (s: string) => s.replace(/\\([nrt\\])/g, (m, c: string) => ESCAPES[c] ?? m)

const mapLines = (s: string, fn: (line: string) => string) =>
  s
    .split('\n')
    .map((raw) => {
      const hasCr = raw.length > 0 && raw.charCodeAt(raw.length - 1) === 13
      const body = hasCr ? raw.slice(0, -1) : raw
      return fn(body) + (hasCr ? '\r' : '')
    })
    .join('\n')

const util: Utility = {
  id: 'insert_at',
  name: 'insert at position',
  category: 'String Ops',
  description:
    'Insert or overwrite text at a character position, counting back from the end when the position is negative, over the whole input or line by line.',
  accepts: 'string',
  produces: 'string',
  tags: ['insert text', 'splice string', 'overwrite text', 'string position', 'character index'],
  examples: [
    {
      title: 'insert into the middle',
      input: 'Hello World',
      params: { text: ', dear', position: 5, mode: 'insert', perLine: false },
      output: 'Hello, dear World'
    },
    {
      title: 'overwrite per line, negative-from-end not used',
      input: 'aaaaa\nbbbbb',
      params: { text: 'XX', position: 2, mode: 'overwrite', perLine: true },
      output: 'aaXXa\nbbXXb'
    }
  ],
  params: {
    text: {
      kind: 'string',
      label: 'text',
      default: '',
      placeholder: 'text to insert — \\n and \\t are understood'
    },
    position: { kind: 'number', label: 'position (negative = from end)', default: 0, integer: true },
    mode: { kind: 'select', label: 'mode', options: ['insert', 'overwrite'], default: 'insert' },
    perLine: { kind: 'boolean', label: 'per line', default: false }
  },
  apply: (input: any, { text: _text, position: _position, mode: _mode, perLine: _perLine }: any) => {
    const s = String(input ?? '')
    const text = decodeEscapes(_text === undefined || _text === null ? '' : String(_text))

    const rawPosition =
      _position === undefined || _position === null || _position === '' ? 0 : Number(_position)
    if (!Number.isInteger(rawPosition)) {
      throw new Error('insert at: position must be a whole number')
    }
    const position = rawPosition

    const mode = _mode === 'overwrite' ? 'overwrite' : 'insert'
    const perLine = Boolean(_perLine)
    const inserted = Array.from(text).length

    const place = (line: string) => {
      // Positions count code points, so an emoji counts as one character and is
      // never cut in half.
      const chars = Array.from(line)
      let at = position < 0 ? chars.length + position : position
      if (at < 0) at = 0
      if (at > chars.length) at = chars.length
      const tail = mode === 'overwrite' ? chars.slice(at + inserted) : chars.slice(at)
      return chars.slice(0, at).join('') + text + tail.join('')
    }

    return perLine ? mapLines(s, place) : place(s)
  }
}

export default util
