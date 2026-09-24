import type { Utility } from '@/types/utility'

/** Friendly aliases so users can type a delimiter name instead of an invisible character. */
const DELIMITER_NAMES: Record<string, string> = {
  tab: '\t',
  comma: ',',
  semicolon: ';',
  semi: ';',
  pipe: '|',
  space: ' ',
  colon: ':',
}

/** Resolve a user-typed delimiter: a name, a `\t`-style escape, or a literal character. */
function resolveDelimiter(raw: unknown, fallback: string): string {
  if (raw === undefined || raw === null) return fallback
  const s = String(raw)
  if (s === '') return fallback
  const named = DELIMITER_NAMES[s.trim().toLowerCase()]
  if (named) return named
  return s.replace(/\\(.)/g, (_m, c: string) =>
    c === 't' ? '\t' : c === 'n' ? '\n' : c === 'r' ? '\r' : c === '0' ? '\0' : c
  )
}

interface ParsedCsv {
  /** Parsed rows of fields. */
  rows: string[][]
  /** Per field: was it written as a `"quoted"` field? */
  quoted: boolean[][]
  /** True when the row separators outside quotes were mostly CRLF. */
  crlf: boolean
}

/**
 * RFC 4180 parser: quoted fields, `""` escapes, embedded newlines and delimiters.
 * Concatenates code units in order, so astral characters survive intact.
 * Records per-field quoting so callers can tell `` from `""`, and counts only the
 * row separators found outside quotes.
 */
function parseCsv(text: string, delimiter: string): ParsedCsv {
  const rows: string[][] = []
  const quoted: boolean[][] = []
  let row: string[] = []
  let rowQuoted: boolean[] = []
  let field = ''
  let fieldQuoted = false
  let inQuotes = false
  let crlfCount = 0
  let lfCount = 0
  let i = 0
  const n = text.length
  const dLen = delimiter.length

  const endField = () => {
    row.push(field)
    rowQuoted.push(fieldQuoted)
    field = ''
    fieldQuoted = false
  }
  const endRow = () => {
    rows.push(row)
    quoted.push(rowQuoted)
    row = []
    rowQuoted = []
  }

  while (i < n) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i += 2
          continue
        }
        inQuotes = false
        i += 1
        continue
      }
      field += ch
      i += 1
      continue
    }
    if (ch === '"' && field === '' && !fieldQuoted) {
      inQuotes = true
      fieldQuoted = true
      i += 1
      continue
    }
    if (dLen > 0 && text.startsWith(delimiter, i)) {
      endField()
      i += dLen
      continue
    }
    if (ch === '\r' || ch === '\n') {
      if (ch === '\r' && text[i + 1] === '\n') {
        crlfCount += 1
        i += 2
      } else {
        lfCount += 1
        i += 1
      }
      endField()
      endRow()
      continue
    }
    field += ch
    i += 1
  }

  if (inQuotes) throw new Error('malformed CSV: unterminated quoted field')

  endField()
  endRow()

  // A trailing newline produces one phantom empty row — but `""` on its own is real data.
  const last = rows[rows.length - 1]
  const lastQuoted = quoted[quoted.length - 1]
  if (last && last.length === 1 && last[0] === '' && !lastQuoted[0]) {
    rows.pop()
    quoted.pop()
  }

  return { rows, quoted, crlf: crlfCount > 0 && crlfCount >= lfCount }
}

/** Drop blank lines: a row of one empty, *unquoted* field. `""` is kept. */
function dropBlankRows(parsed: ParsedCsv): ParsedCsv {
  const rows: string[][] = []
  const quoted: boolean[][] = []
  parsed.rows.forEach((r, i) => {
    const q = parsed.quoted[i]
    if (r.length === 1 && !q[0] && r[0].trim() === '') return
    rows.push(r)
    quoted.push(q)
  })
  return { rows, quoted, crlf: parsed.crlf }
}

/** Score candidate delimiters by column count and row-to-row consistency. */
function detectDelimiter(text: string): string {
  const candidates = [',', '\t', ';', '|']
  let best = ','
  let bestScore = -1
  for (const c of candidates) {
    let rows: string[][]
    try {
      rows = dropBlankRows(parseCsv(text, c)).rows
    } catch {
      continue
    }
    const sample = rows.slice(0, 20)
    if (!sample.length) continue
    const counts = sample.map((r) => r.length)
    const cols = counts[0]
    if (cols < 2) continue
    const consistent = counts.every((x) => x === cols)
    const score = (consistent ? 1000 : 0) + cols
    if (score > bestScore) {
      bestScore = score
      best = c
    }
  }
  return best
}

/**
 * RFC 4180 field quoting: wrap in quotes and double any embedded quote when needed.
 * A field that was quoted in the source and holds nothing but whitespace keeps its
 * quotes, otherwise `""` would come back out as an indistinguishable blank line.
 */
function quoteField(value: string, delimiter: string, wasQuoted: boolean): string {
  const needsQuotes =
    (wasQuoted && value.trim() === '') ||
    value.includes('"') ||
    value.includes('\n') ||
    value.includes('\r') ||
    (delimiter !== '' && value.includes(delimiter))
  if (!needsQuotes) return value
  return `"${value.replace(/"/g, '""')}"`
}

const util: Utility = {
  id: 'csv_transpose',
  name: 'csv transpose',
  category: 'Data Formats',
  description:
    'Flip CSV rows and columns, padding ragged rows and re-quoting fields, with delimiter auto-detection or an explicit delimiter.',
  accepts: 'string',
  produces: 'string',
  tags: ['csv', 'transpose', 'flip', 'rows', 'columns', 'pivot'],
  examples: [
    {
      title: 'transpose a small grid',
      input: 'a,b,c\n1,2,3',
      params: { delimiter: 'auto' },
      output: 'a,1\nb,2\nc,3'
    }
  ],
  params: {
    delimiter: { kind: 'string', label: 'delimiter', default: 'auto', placeholder: 'auto, or , ; \\t |' },
  },
  apply: (input: any, params: any) => {
    const { delimiter: delimiterParam } = params ?? {}
    const text = String(input ?? '')
    if (text.trim() === '') return ''

    const raw = String(delimiterParam ?? 'auto').trim()
    const delimiter =
      raw === '' || raw.toLowerCase() === 'auto' ? detectDelimiter(text) : resolveDelimiter(delimiterParam, ',')
    if (delimiter === '') throw new Error('delimiter must not be empty')

    const { rows, quoted, crlf } = dropBlankRows(parseCsv(text, delimiter))
    if (!rows.length) return ''

    const width = rows.reduce((max, r) => Math.max(max, r.length), 0)
    // CRLF inside a quoted field is field content, not a row separator.
    const eol = crlf ? '\r\n' : '\n'

    const out: string[] = []
    for (let c = 0; c < width; c += 1) {
      const line = rows.map((r, ri) => quoteField(r[c] ?? '', delimiter, quoted[ri][c] ?? false))
      out.push(line.join(delimiter))
    }

    return out.join(eol)
  },
}

export default util
