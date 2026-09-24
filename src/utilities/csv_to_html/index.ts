import type { Utility } from '@/types/utility'

/** Turn a user-typed delimiter (`\t`, `\|`, `\\`, …) into the real character(s). */
const unescapeDelimiter = (raw: string): string =>
  raw.replace(/\\(.)/g, (_m, c: string) =>
    c === 't' ? '\t' : c === 'n' ? '\n' : c === 'r' ? '\r' : c
  )

/**
 * RFC 4180 parser: quoted fields, embedded newlines and `""` escapes.
 * Throws on an unterminated quoted field so the step surfaces the problem.
 */
export function parseCsv(text: string, delimiter: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  let i = 0
  const n = text.length
  const dlen = delimiter.length

  while (i < n) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue }
        inQuotes = false; i++; continue
      }
      field += ch; i++; continue
    }
    if (ch === '"' && field === '') { inQuotes = true; i++; continue }
    if (dlen > 0 && text.startsWith(delimiter, i)) { row.push(field); field = ''; i += dlen; continue }
    if (ch === '\r' || ch === '\n') {
      i += ch === '\r' && text[i + 1] === '\n' ? 2 : 1
      row.push(field); field = ''
      rows.push(row); row = []
      continue
    }
    field += ch; i++
  }
  if (inQuotes) throw new Error('unterminated quoted field in CSV')
  row.push(field)
  rows.push(row)
  // a trailing newline should not produce a phantom row
  const last = rows[rows.length - 1]
  if (rows.length > 1 && last.length === 1 && last[0] === '') rows.pop()
  return rows
}

const CANDIDATES = [',', '\t', ';', '|']

/** Pick the delimiter that yields the widest, most consistent grid. */
export function detectDelimiter(text: string): string {
  let best = ','
  let bestScore = -1
  for (const d of CANDIDATES) {
    let rows: string[][]
    try { rows = parseCsv(text, d) } catch { continue }
    if (rows.length === 0) continue
    const widths = rows.map((r) => r.length)
    const first = widths[0]
    if (first < 2) continue
    const consistent = widths.filter((w) => w === first).length / widths.length
    const score = consistent * 100 + first
    if (score > bestScore) { bestScore = score; best = d }
  }
  return best
}

export const escapeHtml = (s: string): string =>
  s.replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

/**
 * Cell markup. An RFC 4180 field may contain newlines; a raw newline in HTML
 * renders as a space, so it becomes `<br>` — which is also what keeps a
 * round-trip through `html_table_to_csv` lossless.
 */
export const cellHtml = (value: string): string =>
  escapeHtml(value).replace(/\r\n|[\r\n]/g, '<br>')

const util: Utility = {
  id: 'csv_to_html',
  name: 'csv to html table',
  category: 'Data Formats',
  description:
    'Render CSV as an HTML <table>, with delimiter auto-detection, an optional header row, a table class name, and configurable indentation.',
  accepts: 'string',
  produces: 'string',
  tags: ['csv', 'html', 'table', 'convert', 'markup', 'thead', 'tbody'],
  examples: [
    {
      title: 'CSV to an HTML table',
      input: 'name,email,age\nAda Lovelace,ada@example.com,36\nGrace Hopper,grace@example.com,85',
      params: { delimiter: 'auto', header: true, className: '', indent: 2 },
      output:
        '<table>\n  <thead>\n    <tr>\n      <th>name</th>\n      <th>email</th>\n      <th>age</th>\n    </tr>\n  </thead>\n  <tbody>\n    <tr>\n      <td>Ada Lovelace</td>\n      <td>ada@example.com</td>\n      <td>36</td>\n    </tr>\n    <tr>\n      <td>Grace Hopper</td>\n      <td>grace@example.com</td>\n      <td>85</td>\n    </tr>\n  </tbody>\n</table>'
    }
  ],
  params: {
    delimiter: { kind: 'string', label: 'delimiter', default: 'auto', placeholder: 'auto, , ; | or \\t' },
    header: { kind: 'boolean', label: 'first row is header', default: true },
    className: { kind: 'string', label: 'table class', default: '', placeholder: 'e.g. table table-striped' },
    indent: { kind: 'number', label: 'indent', default: 2, min: 0, max: 16, integer: true }
  },
  apply: (input: any, { delimiter, header, className, indent }: any) => {
    const text = String(input ?? '').replace(/^\uFEFF/, '')
    // an empty box is not an error the user needs to see yet
    if (text.trim() === '') return ''

    const rawDelim = String(delimiter ?? 'auto')
    const delim = rawDelim === 'auto' || rawDelim === '' ? detectDelimiter(text) : unescapeDelimiter(rawDelim)

    const rows = parseCsv(text, delim)
    if (rows.length === 0) return ''

    const useHeader = header !== false
    const cls = String(className ?? '')
    const step = Math.max(0, Number(indent ?? 2) || 0)
    const pad = (level: number) => ' '.repeat(step * level)

    const width = rows.reduce((m, r) => Math.max(m, r.length), 0)
    const cell = (tag: 'th' | 'td', value: string, level: number) =>
      `${pad(level)}<${tag}>${cellHtml(value)}</${tag}>`
    const rowLines = (cells: string[], tag: 'th' | 'td', level: number) => {
      const padded = cells.slice()
      while (padded.length < width) padded.push('')
      return [
        `${pad(level)}<tr>`,
        ...padded.map((c) => cell(tag, c, level + 1)),
        `${pad(level)}</tr>`
      ]
    }

    const out: string[] = []
    out.push(cls ? `<table class="${escapeHtml(cls)}">` : '<table>')

    const bodyRows = useHeader ? rows.slice(1) : rows
    if (useHeader) {
      out.push(`${pad(1)}<thead>`)
      out.push(...rowLines(rows[0], 'th', 2))
      out.push(`${pad(1)}</thead>`)
    }
    out.push(`${pad(1)}<tbody>`)
    for (const r of bodyRows) out.push(...rowLines(r, 'td', 2))
    out.push(`${pad(1)}</tbody>`)
    out.push('</table>')

    return out.join('\n')
  }
}

export default util
