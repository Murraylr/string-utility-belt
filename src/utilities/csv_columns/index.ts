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

function csvField(value: string, delimiter: string): string {
  if (
    value.includes('"') ||
    value.includes('\n') ||
    value.includes('\r') ||
    value.includes(delimiter)
  ) {
    return '"' + value.replace(/"/g, '""') + '"'
  }
  return value
}

/** Split a comma list, honouring `"quoted, names"`. */
function splitList(spec: string): string[] {
  const out: string[] = []
  let cur = ''
  let quoted = false
  let inQuotes = false
  const push = () => {
    const value = quoted ? cur : cur.trim()
    if (value !== '') out.push(value)
    cur = ''
    quoted = false
  }
  for (let i = 0; i < spec.length; i++) {
    const c = spec[i]
    if (inQuotes) {
      if (c === '"') {
        if (spec[i + 1] === '"') {
          cur += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        cur += c
      }
      continue
    }
    if (c === '"') {
      inQuotes = true
      quoted = true
      continue
    }
    if (c === ',') {
      push()
      continue
    }
    cur += c
  }
  push()
  return out
}

function resolveColumns(specs: string[], header: Row | null, width: number): number[] {
  return specs.map((spec) => {
    if (header) {
      const exact = header.indexOf(spec)
      if (exact >= 0) return exact
      const lower = spec.toLowerCase()
      const loose = header.findIndex((h) => h.trim().toLowerCase() === lower)
      if (loose >= 0) return loose
    }
    if (/^\d+$/.test(spec)) {
      const n = Number(spec)
      if (n < 1) throw new Error(`column index must be 1-based, got "${spec}"`)
      if (n > width) throw new Error(`column ${n} is out of range (the table has ${width} columns)`)
      return n - 1
    }
    throw new Error(
      header
        ? `unknown column: "${spec}"`
        : `expected a 1-based column index, got "${spec}" (header is off, so names cannot be used)`
    )
  })
}

const util: Utility = {
  id: 'csv_columns',
  name: 'csv select columns',
  category: 'Data Formats',
  description:
    'Keep or drop CSV columns by name or 1-based index, reordering them to match your list; leave the list empty to pass the table through.',
  accepts: 'string',
  produces: 'string',
  tags: ['csv', 'columns', 'select', 'filter', 'keep', 'drop', 'table', 'fields'],
  examples: [
    {
      title: 'keep two columns by name',
      input: 'name,email,age\nAda Lovelace,ada@example.com,36\nGrace Hopper,grace@example.com,85',
      params: { columns: 'name, age', mode: 'keep', delimiter: 'auto', header: true },
      output: 'name,age\nAda Lovelace,36\nGrace Hopper,85'
    }
  ],
  params: {
    columns: {
      kind: 'string',
      label: 'columns',
      default: '',
      placeholder: 'name, email, 3'
    },
    mode: {
      kind: 'select',
      label: 'mode',
      options: ['keep', 'drop'],
      default: 'keep'
    },
    delimiter: {
      kind: 'string',
      label: 'delimiter',
      default: 'auto',
      placeholder: 'auto, , ; \\t'
    },
    header: {
      kind: 'boolean',
      label: 'first row is a header',
      default: true
    }
  },
  apply: (
    input: any,
    { columns = '', mode = 'keep', delimiter = 'auto', header = true }: any = {}
  ) => {
    const text = String(input ?? '')
    if (text.trim() === '') return ''

    const specs = splitList(String(columns ?? ''))
    const delim = resolveDelimiter(delimiter, text)
    const rows = parseCsv(text, delim)
    if (rows.length === 0) return ''
    // Nothing selected: keep everything (and drop nothing) — a freshly added step is a no-op.
    if (specs.length === 0) return text

    const width = Math.max(...rows.map((r) => r.length))
    const headerRow = header === false ? null : rows[0]
    const picked = resolveColumns(specs, headerRow, width)

    let indices: number[]
    if (mode === 'drop') {
      const dropped = new Set(picked)
      indices = []
      for (let i = 0; i < width; i++) if (!dropped.has(i)) indices.push(i)
    } else {
      indices = picked
    }
    if (indices.length === 0) return ''

    const eol = /\r\n/.test(text) ? '\r\n' : '\n'
    const trailing = /(\r\n|\n|\r)$/.test(text) ? eol : ''
    return (
      rows
        .map((row) => indices.map((i) => csvField(row[i] ?? '', delim)).join(delim))
        .join(eol) + trailing
    )
  }
}

export default util
