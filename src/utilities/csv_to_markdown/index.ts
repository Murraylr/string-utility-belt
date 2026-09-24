import type { Utility } from '@/types/utility'

type Row = string[]

const DELIMITER_CANDIDATES = [',', '\t', ';', '|']

/** Expand backslash escapes so `\t` can be typed into a single-line param. */
function unescapeDelimiter(raw: string): string {
  let out = ''
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i]
    if (c === '\\' && i + 1 < raw.length) {
      const n = raw[i + 1]
      i++
      if (n === 't') out += '\t'
      else if (n === 'n') out += '\n'
      else if (n === 'r') out += '\r'
      else if (n === '\\') out += '\\'
      else out += '\\' + n
    } else {
      out += c
    }
  }
  return out
}

/** RFC 4180 parser: quoted fields, embedded newlines, `""` escapes. Blank lines are skipped. */
function parseCsv(text: string, delimiter: string): Row[] {
  const rows: Row[] = []
  let row: Row = []
  let field = ''
  let inQuotes = false
  let i = 0
  while (i < text.length) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i += 2
          continue
        }
        inQuotes = false
        i++
        continue
      }
      field += c
      i++
      continue
    }
    if (c === '"' && field === '') {
      inQuotes = true
      i++
      continue
    }
    if (delimiter !== '' && text.startsWith(delimiter, i)) {
      row.push(field)
      field = ''
      i += delimiter.length
      continue
    }
    if (c === '\n' || c === '\r') {
      row.push(field)
      field = ''
      rows.push(row)
      row = []
      i += c === '\r' && text[i + 1] === '\n' ? 2 : 1
      continue
    }
    field += c
    i++
  }
  if (inQuotes) throw new Error('unterminated quoted field in CSV input')
  if (field !== '' || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows.filter((r) => r.length > 1 || r[0] !== '')
}

/** Score each candidate delimiter by how consistently it splits the rows. */
function detectDelimiter(text: string): string {
  let best = ','
  let bestScore = -1
  for (const candidate of DELIMITER_CANDIDATES) {
    let rows: Row[]
    try {
      rows = parseCsv(text, candidate)
    } catch {
      continue
    }
    if (rows.length === 0) continue
    const width = rows[0].length
    if (width < 2) continue
    const consistent = rows.filter((r) => r.length === width).length / rows.length
    const score = consistent * 100 + Math.min(width, 50)
    if (score > bestScore) {
      bestScore = score
      best = candidate
    }
  }
  return best
}

function resolveDelimiter(raw: unknown, text: string): string {
  const spec = raw === undefined || raw === null ? 'auto' : String(raw)
  if (spec === '' || spec.toLowerCase() === 'auto') return detectDelimiter(text)
  const delimiter = unescapeDelimiter(spec)
  return delimiter === '' ? detectDelimiter(text) : delimiter
}

/** Cells cannot contain a raw pipe or a line break inside a markdown table. */
function escapeCell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\r\n|\r|\n/g, '<br>')
}

/** Width in code points, so an astral character counts as one column. */
const cpLength = (s: string) => Array.from(s).length

function pad(cell: string, width: number, align: string): string {
  const gap = width - cpLength(cell)
  if (gap <= 0) return cell
  if (align === 'right') return ' '.repeat(gap) + cell
  if (align === 'center') {
    const left = Math.floor(gap / 2)
    return ' '.repeat(left) + cell + ' '.repeat(gap - left)
  }
  return cell + ' '.repeat(gap)
}

function separator(width: number, align: string): string {
  if (align === 'right') return '-'.repeat(width - 1) + ':'
  if (align === 'center') return ':' + '-'.repeat(width - 2) + ':'
  if (align === 'none') return '-'.repeat(width)
  return ':' + '-'.repeat(width - 1)
}

const util: Utility = {
  id: 'csv_to_markdown',
  name: 'csv to markdown table',
  category: 'Data Formats',
  description:
    'Convert CSV to a padded markdown pipe table with left, center, right, or no column alignment.',
  accepts: 'string',
  produces: 'string',
  tags: ['csv', 'markdown', 'table', 'convert', 'pipe table', 'markup'],
  examples: [
    {
      title: 'CSV to a left-aligned markdown table',
      input: 'name,email,age\nAda Lovelace,ada@example.com,36\nGrace Hopper,grace@example.com,85',
      params: { delimiter: 'auto', align: 'left', header: true },
      output:
        '| name         | email             | age |\n| :----------- | :---------------- | :-- |\n| Ada Lovelace | ada@example.com   | 36  |\n| Grace Hopper | grace@example.com | 85  |'
    }
  ],
  params: {
    delimiter: {
      kind: 'string',
      label: 'delimiter',
      default: 'auto',
      placeholder: 'auto, , ; \\t'
    },
    align: {
      kind: 'select',
      label: 'align',
      options: ['left', 'center', 'right', 'none'],
      default: 'left'
    },
    header: {
      kind: 'boolean',
      label: 'first row is a header',
      default: true
    }
  },
  apply: (input: any, { delimiter = 'auto', align = 'left', header = true }: any = {}) => {
    const text = String(input ?? '')
    if (text.trim() === '') return ''

    const delim = resolveDelimiter(delimiter, text)
    const rows = parseCsv(text, delim)
    if (rows.length === 0) return ''

    const columns = Math.max(...rows.map((r) => r.length))
    const normalized = rows.map((row) => {
      const cells = row.map(escapeCell)
      while (cells.length < columns) cells.push('')
      return cells
    })

    // With no header row the table still needs one, so emit a blank header.
    const headerRow = header === false ? new Array(columns).fill('') : (normalized.shift() as Row)
    const body = normalized

    const widths: number[] = []
    for (let i = 0; i < columns; i++) {
      let w = 3
      for (const row of [headerRow, ...body]) w = Math.max(w, cpLength(row[i]))
      widths.push(w)
    }

    const line = (cells: string[]) =>
      '| ' + cells.map((cell, i) => pad(cell, widths[i], align)).join(' | ') + ' |'

    const out = [
      line(headerRow),
      '| ' + widths.map((w) => separator(w, align)).join(' | ') + ' |',
      ...body.map(line)
    ]
    return out.join('\n')
  }
}

export default util
