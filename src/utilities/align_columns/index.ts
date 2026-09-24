import type { Utility } from '@/types/utility'

type Align = 'left' | 'right' | 'auto'

/** Interpret the backslash escapes a single-line text input cannot carry literally. */
function unescape(s: string): string {
  return s.replace(/\\([tnr\\])/g, (_m, c: string) =>
    c === 't' ? '\t' : c === 'n' ? '\n' : c === 'r' ? '\r' : '\\'
  )
}

/** Marks and zero-width characters occupy no column; wide CJK/emoji occupy two. */
const ZERO_WIDTH = /[\p{Mn}\p{Me}\p{Cf}]/u

function charWidth(ch: string): number {
  if (ZERO_WIDTH.test(ch)) return 0
  const c = ch.codePointAt(0) as number
  if (
    (c >= 0x1100 && c <= 0x115f) ||
    (c >= 0x2e80 && c <= 0x303e) ||
    (c >= 0x3041 && c <= 0x33ff) ||
    (c >= 0x3400 && c <= 0x4dbf) ||
    (c >= 0x4e00 && c <= 0x9fff) ||
    (c >= 0xa000 && c <= 0xa4cf) ||
    (c >= 0xac00 && c <= 0xd7a3) ||
    (c >= 0xf900 && c <= 0xfaff) ||
    (c >= 0xfe30 && c <= 0xfe6f) ||
    (c >= 0xff00 && c <= 0xff60) ||
    (c >= 0xffe0 && c <= 0xffe6) ||
    (c >= 0x1f300 && c <= 0x1f9ff) ||
    (c >= 0x20000 && c <= 0x3fffd)
  ) {
    return 2
  }
  return 1
}

/** Display width in columns, iterating code points so astral characters stay whole. */
function displayWidth(s: string): number {
  let n = 0
  for (const ch of s) n += charWidth(ch)
  return n
}

/** A cell that should hang off the right edge under `align: auto`. */
function isNumericCell(s: string): boolean {
  const t = s.trim().replace(/[,_\s]/g, '').replace(/^[+-]/, '').replace(/%$/, '')
  return t !== '' && /^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(t)
}

function boolParam(v: unknown, name: string, dflt: boolean): boolean {
  if (v === undefined || v === null || v === '') return dflt
  if (typeof v === 'boolean') return v
  if (v === 'true') return true
  if (v === 'false') return false
  throw new Error(`${name} must be true or false`)
}

function selectParam<T extends string>(v: unknown, name: string, options: readonly T[], dflt: T): T {
  if (v === undefined || v === null || v === '') return dflt
  const s = String(v)
  if (!(options as readonly string[]).includes(s)) {
    throw new Error(`${name} must be one of ${options.join(', ')} (got "${s}")`)
  }
  return s as T
}

const util: Utility = {
  id: 'align_columns',
  name: 'align columns',
  category: 'Formatting',
  description:
    'Pad columns so they line up like column -t, with an auto or custom input delimiter, a custom output separator, left/right/auto alignment, and an optional header rule.',
  accepts: 'string',
  produces: 'string',
  tags: ['table', 'columns', 'align', 'pretty print', 'csv', 'tsv', 'whitespace'],
  aliases: ['column -t'],
  examples: [
    { title: 'whitespace-delimited', input: 'name age\nAlice 30\nBob 7', output: 'name   age\nAlice  30\nBob    7' },
    { title: 'CSV, right-aligned', input: 'a,bb\nccc,d', params: { delimiter: ',', align: 'right' }, output: '  a  bb\nccc   d' }
  ],
  params: {
    delimiter: {
      kind: 'string',
      label: 'input delimiter ("auto" = whitespace runs)',
      default: 'auto',
      placeholder: 'auto, "," or "\\t"'
    },
    outputDelimiter: { kind: 'string', label: 'output delimiter', default: '  ' },
    align: { kind: 'select', label: 'align', options: ['left', 'right', 'auto'], default: 'left' },
    header: { kind: 'boolean', label: 'first row is a header (adds a rule under it)', default: false }
  },
  apply: (input: any, params: any) => {
    const p = params ?? {}
    const rawDelimiter = p.delimiter === undefined || p.delimiter === null ? 'auto' : String(p.delimiter)
    const outputDelimiter =
      p.outputDelimiter === undefined || p.outputDelimiter === null
        ? '  '
        : unescape(String(p.outputDelimiter))
    const align = selectParam<Align>(p.align, 'align', ['left', 'right', 'auto'] as const, 'left')
    const header = boolParam(p.header, 'header', false)

    const useWhitespace = rawDelimiter === 'auto'
    const delimiter = useWhitespace ? '' : unescape(rawDelimiter)
    if (!useWhitespace && delimiter === '') {
      throw new Error('delimiter must not be empty — use "auto" to split on whitespace runs')
    }

    const s = String(input)
    if (s === '') return ''

    // Preserve the document's line ending style and whether it ended with one.
    const eol = s.includes('\r\n') ? '\r\n' : !s.includes('\n') && s.includes('\r') ? '\r' : '\n'
    const trailing = /(?:\r\n|\n|\r)$/.exec(s)
    const body = trailing ? s.slice(0, s.length - trailing[0].length) : s

    const rows: string[][] = body.split(/\r\n|\n|\r/).map((line) => {
      if (line.trim() === '') return []
      if (useWhitespace) return line.trim().split(/\s+/)
      return line.split(delimiter).map((cell) => cell.trim())
    })

    const colCount = rows.reduce((n, r) => Math.max(n, r.length), 0)
    const widths: number[] = new Array(colCount).fill(0)
    for (const row of rows) {
      row.forEach((cell, i) => {
        widths[i] = Math.max(widths[i], displayWidth(cell))
      })
    }

    // `auto` right-aligns a column only when every value in it is a number;
    // the header row is excluded from that vote so a label cannot veto it.
    const dataRows = header ? rows.slice(1) : rows
    const alignments: Array<'left' | 'right'> = widths.map((_w, i) => {
      if (align !== 'auto') return align
      const cells = dataRows.map((r) => r[i] ?? '').filter((c) => c !== '')
      return cells.length > 0 && cells.every(isNumericCell) ? 'right' : 'left'
    })

    const padCell = (cell: string, i: number) => {
      const gap = widths[i] - displayWidth(cell)
      if (gap <= 0) return cell
      return alignments[i] === 'right' ? ' '.repeat(gap) + cell : cell + ' '.repeat(gap)
    }

    // Pad every cell, then shave whatever padding hangs off the right edge. Doing it
    // after the join is what makes it correct: skipping only the last cell's padding
    // still leaves a run of spaces behind when the row's trailing cells are empty,
    // because the output delimiters before them are emitted regardless.
    const trimRight = (line: string) => line.replace(/[ \t]+$/, '')

    const out = rows.map((row) =>
      row.length === 0 ? '' : trimRight(row.map((cell, i) => padCell(cell, i)).join(outputDelimiter))
    )

    if (header && rows.length > 0 && rows[0].length > 0) {
      const rule = trimRight(rows[0].map((_c, i) => '-'.repeat(widths[i])).join(outputDelimiter))
      out.splice(1, 0, rule)
    }

    return out.join(eol) + (trailing ? eol : '')
  }
}

export default util
