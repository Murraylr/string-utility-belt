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

export interface ParsedCsv {
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
 * Records per-field quoting so callers can tell `` from `""` and can leave
 * deliberately padded values alone.
 */
export function parseCsv(text: string, delimiter: string): ParsedCsv {
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
export function dropBlankRows(parsed: ParsedCsv): ParsedCsv {
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
export function detectDelimiter(text: string): string {
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

const NUMERIC = /^-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?$/

/** Coerce a CSV cell to number / boolean / null when `typed` is on. */
function coerceScalar(s: string): unknown {
  if (s === '') return ''
  const lower = s.toLowerCase()
  if (lower === 'true') return true
  if (lower === 'false') return false
  if (lower === 'null') return null
  if (NUMERIC.test(s)) {
    const n = Number(s)
    // Keep long integers as text rather than lose precision.
    const digits = s.replace(/^-/, '').replace(/[.eE].*$/, '').length
    if (Number.isFinite(n) && (String(n) === s || digits < 16)) return n
  }
  return s
}

const util: Utility = {
  id: 'csv_to_json',
  name: 'csv to json',
  category: 'Data Formats',
  description:
    'Parse RFC 4180 CSV (quoted fields, embedded newlines, "" escapes) into JSON, with delimiter auto-detection, optional header keys, value typing, trimming, and indent control.',
  accepts: 'string',
  produces: 'string',
  tags: ['csv', 'json', 'convert', 'parse', 'table', 'typed', 'records'],
  examples: [
    {
      title: 'typed CSV to JSON records',
      input: 'name,email,age\nAda Lovelace,ada@example.com,36\nGrace Hopper,grace@example.com,85',
      params: { delimiter: 'auto', header: true, typed: true, trim: true, indent: 2 },
      output:
        '[\n  {\n    "name": "Ada Lovelace",\n    "email": "ada@example.com",\n    "age": 36\n  },\n  {\n    "name": "Grace Hopper",\n    "email": "grace@example.com",\n    "age": 85\n  }\n]'
    }
  ],
  params: {
    delimiter: { kind: 'string', label: 'delimiter', default: 'auto', placeholder: 'auto, or , ; \\t |' },
    header: { kind: 'boolean', label: 'first row is header', default: true },
    typed: { kind: 'boolean', label: 'coerce numbers/booleans/null', default: false },
    trim: { kind: 'boolean', label: 'trim fields', default: true },
    indent: { kind: 'number', label: 'indent', default: 2, min: 0, max: 16, integer: true },
  },
  apply: (input: any, params: any) => {
    const { delimiter: delimiterParam, header: headerParam, typed: typedParam, trim: trimParam, indent } =
      params ?? {}

    const text = String(input ?? '')
    const indentSize = Math.max(0, Number(indent ?? 2) || 0)
    if (text.trim() === '') return '[]'

    const header = headerParam !== false
    const typed = typedParam === true
    const trim = trimParam !== false

    const raw = String(delimiterParam ?? 'auto').trim()
    const delimiter =
      raw === '' || raw.toLowerCase() === 'auto' ? detectDelimiter(text) : resolveDelimiter(delimiterParam, ',')
    if (delimiter === '') throw new Error('delimiter must not be empty')

    const { rows, quoted } = dropBlankRows(parseCsv(text, delimiter))
    if (!rows.length) return '[]'

    // A quoted field is an explicit "these spaces are data" signal, so `trim` skips it
    // (same rule as csv-parse).
    const clean = (s: string, isQuoted: boolean) => (trim && !isQuoted ? s.trim() : s)
    const value = (s: string, isQuoted: boolean): unknown =>
      typed ? coerceScalar(clean(s, isQuoted)) : clean(s, isQuoted)

    if (!header) {
      const out = rows.map((r, ri) => r.map((f, ci) => value(f, quoted[ri][ci])))
      return JSON.stringify(out, null, indentSize)
    }

    // One key per column of the widest row: blank and missing names get a positional
    // fallback, and every duplicate gets a suffix so no field can overwrite another.
    const width = rows.reduce((max, r) => Math.max(max, r.length), 0)
    const used = new Set<string>()
    const keys: string[] = []
    for (let i = 0; i < width; i += 1) {
      let name = i < rows[0].length ? clean(rows[0][i], quoted[0][i]) : ''
      if (name === '') name = `column_${i + 1}`
      if (used.has(name)) {
        let n = 2
        while (used.has(`${name}_${n}`)) n += 1
        name = `${name}_${n}`
      }
      used.add(name)
      keys.push(name)
    }

    const out = rows.slice(1).map((r, ri) => {
      const q = quoted[ri + 1]
      const rec: Record<string, unknown> = {}
      keys.forEach((k, i) => {
        rec[k] = i < r.length ? value(r[i], q[i]) : ''
      })
      return rec
    })

    return JSON.stringify(out, null, indentSize)
  },
}

export default util
