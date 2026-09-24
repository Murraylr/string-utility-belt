import type { Utility } from '@/types/utility'

/**
 * Split into lines while remembering the exact terminator that followed each one, so a file
 * with mixed endings is not silently rewritten to a single style. `eols[i]` is `''` only for a
 * final line that the input left unterminated.
 */
function splitLines(s: string): { lines: string[]; eols: string[] } {
  const lines: string[] = []
  const eols: string[] = []
  const re = /\r\n|\n/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(s)) !== null) {
    lines.push(s.slice(last, m.index))
    eols.push(m[0])
    last = re.lastIndex
  }
  if (last < s.length) {
    lines.push(s.slice(last))
    eols.push('')
  }
  return { lines, eols }
}

const util: Utility = {
  id: 'line_reverse',
  name: 'reverse line order',
  category: 'Lines',
  description: 'Reverse the order of the lines, keeping each line and the line endings intact.',
  accepts: 'string',
  produces: 'string',
  tags: ['reverse lines', 'flip order', 'tac', 'invert lines', 'reverse order'],
  aliases: ['tac'],
  examples: [
    { title: 'reverse three lines', input: 'one\ntwo\nthree', output: 'three\ntwo\none' }
  ],
  params: {},
  apply: (input: any) => {
    const s = String(input)
    if (s === '') return ''

    // the line contents are reversed; the separators stay where they are, so the file keeps
    // its own endings (including a mixed CRLF/LF file) and its trailing newline or lack of one
    const { lines, eols } = splitLines(s)
    let out = ''
    for (let i = 0; i < lines.length; i++) out += lines[lines.length - 1 - i] + eols[i]
    return out
  }
}

export default util
