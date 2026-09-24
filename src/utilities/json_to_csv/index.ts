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

/**
 * RFC 4180 field quoting: wrap in quotes and double any embedded quote when needed.
 * Leading/trailing whitespace is quoted too, so readers that trim unquoted fields
 * (csv_to_json among them) still round-trip the value exactly.
 */
function quoteField(value: string, delimiter: string): string {
  const needsQuotes =
    value.includes('"') ||
    value.includes('\n') ||
    value.includes('\r') ||
    /^\s|\s$/.test(value) ||
    (delimiter !== '' && value.includes(delimiter))
  if (!needsQuotes) return value
  return `"${value.replace(/"/g, '""')}"`
}

/** Render any JSON value as a single CSV cell. */
function cellText(v: unknown): string {
  if (v === null || v === undefined) return ''
  if (typeof v === 'string') return v
  if (typeof v === 'number' || typeof v === 'boolean' || typeof v === 'bigint') return String(v)
  try {
    return JSON.stringify(v) ?? ''
  } catch {
    return String(v)
  }
}

/** Flatten nested structures into `a.b` / `a[0]` paths. */
function flattenInto(value: unknown, prefix: string, out: Record<string, unknown>): void {
  if (Array.isArray(value)) {
    if (value.length === 0) {
      out[prefix] = ''
      return
    }
    value.forEach((v, i) => flattenInto(v, `${prefix}[${i}]`, out))
    return
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
    if (entries.length === 0) {
      out[prefix] = ''
      return
    }
    for (const [k, v] of entries) flattenInto(v, prefix ? `${prefix}.${k}` : k, out)
    return
  }
  out[prefix] = value
}

function flattenRecord(rec: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(rec)) flattenInto(v, k, out)
  return out
}

const isPlainRecord = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v)

const util: Utility = {
  id: 'json_to_csv',
  name: 'json to csv',
  category: 'Data Formats',
  description:
    'Convert an array of JSON objects to CSV with a custom delimiter, optional header row, column selection, nested-value flattening, and LF or CRLF line endings.',
  accepts: ['string', 'json'],
  produces: 'string',
  tags: ['json', 'csv', 'array to csv', 'export', 'spreadsheet', 'flatten'],
  examples: [
    {
      title: 'array of objects with header',
      input: '[{"name":"Ada","age":36},{"name":"Grace","age":85}]',
      output: 'name,age\nAda,36\nGrace,85'
    },
    {
      title: 'tab delimiter (named)',
      input: '[{"a":1,"b":2}]',
      params: { delimiter: 'tab' },
      output: 'a\tb\n1\t2'
    }
  ],
  params: {
    delimiter: { kind: 'string', label: 'delimiter', default: ',', placeholder: ', or ; or \\t' },
    header: { kind: 'boolean', label: 'header row', default: true },
    flatten: { kind: 'boolean', label: 'flatten nested', default: false },
    eol: { kind: 'select', label: 'line endings', options: ['lf', 'crlf'], default: 'lf' },
    columns: { kind: 'string', label: 'columns (comma list)', default: '', placeholder: 'name,email' },
  },
  apply: (input: any, params: any) => {
    const {
      delimiter: delimiterParam,
      header: headerParam,
      flatten: flattenParam,
      eol: eolParam,
      columns: columnsParam,
    } = params ?? {}

    const delimiter = resolveDelimiter(delimiterParam, ',')
    if (delimiter === '') throw new Error('delimiter must not be empty')
    if (delimiter === '"') throw new Error('delimiter must not be the quote character')

    const header = headerParam !== false
    const flatten = flattenParam === true
    const eol = String(eolParam ?? 'lf').toLowerCase() === 'crlf' ? '\r\n' : '\n'
    const wanted = String(columnsParam ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)

    // Accept either a real JSON value (from a previous step) or JSON text.
    let data: unknown
    if (typeof input === 'string' || input === null || input === undefined) {
      const text = String(input ?? '').trim()
      if (text === '') return ''
      try {
        data = JSON.parse(text)
      } catch (e: any) {
        throw new Error(`invalid JSON: ${e?.message || String(e)}`)
      }
    } else {
      data = input
    }

    const serialize = (rows: string[][]): string =>
      rows.map((r) => r.map((f) => quoteField(f, delimiter)).join(delimiter)).join(eol)

    // Shape 1: an array of arrays is already a matrix of cells, with row 0 as the header.
    if (Array.isArray(data) && data.length > 0 && data.every((r) => Array.isArray(r))) {
      let matrix = (data as unknown[][]).map((r) => r.map(cellText))
      const headerRow = matrix[0] ?? []
      const width = matrix.reduce((max, r) => Math.max(max, r.length), 0)
      if (wanted.length) {
        const indexes = wanted.map((c) => {
          const n = Number(c)
          if (Number.isInteger(n) && n >= 1) {
            if (n > width) throw new Error(`unknown column: ${c}`)
            return n - 1
          }
          const at = headerRow.indexOf(c)
          if (at < 0) throw new Error(`unknown column: ${c}`)
          return at
        })
        matrix = matrix.map((r) => indexes.map((i) => r[i] ?? ''))
      }
      if (!header) matrix = matrix.slice(1)
      return serialize(matrix)
    }

    // Shape 2: everything else becomes a list of records.
    let records: Record<string, unknown>[]
    if (Array.isArray(data)) {
      if (data.length === 0) return ''
      records = data.map((r) => (isPlainRecord(r) ? r : { value: r }))
    } else if (isPlainRecord(data)) {
      records = [data]
    } else {
      records = [{ value: data }]
    }

    if (flatten) records = records.map(flattenRecord)

    // Union of keys, in first-appearance order.
    const columns: string[] = []
    const seen = new Set<string>()
    for (const rec of records) {
      for (const k of Object.keys(rec)) {
        if (!seen.has(k)) {
          seen.add(k)
          columns.push(k)
        }
      }
    }

    let finalColumns = columns
    if (wanted.length) {
      for (const c of wanted) if (!seen.has(c)) throw new Error(`unknown column: ${c}`)
      finalColumns = wanted
    }

    if (finalColumns.length === 0) return ''

    const rows: string[][] = []
    if (header) rows.push(finalColumns.slice())
    for (const rec of records) rows.push(finalColumns.map((c) => cellText(rec[c])))

    return serialize(rows)
  },
}

export default util
