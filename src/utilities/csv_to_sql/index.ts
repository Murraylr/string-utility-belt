import type { Utility } from '@/types/utility'

type Dialect = 'ansi' | 'mysql' | 'postgres' | 'mssql' | 'sqlite'

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

const IDENT: Record<Dialect, [string, string]> = {
  ansi: ['"', '"'],
  postgres: ['"', '"'],
  sqlite: ['"', '"'],
  mysql: ['`', '`'],
  mssql: ['[', ']']
}

/**
 * Quote ONE identifier. A dot is just a character here — column names such as
 * `user.name` must stay a single identifier, not become a qualified reference.
 */
export function quoteIdent(name: string, dialect: Dialect): string {
  const [open, close] = IDENT[dialect]
  return `${open}${name.split(close).join(close + close)}${close}`
}

/** Quote a possibly `schema.table` name: the dots stay, each part is quoted. */
export function quoteQualifiedName(name: string, dialect: Dialect): string {
  const parts = name.split('.').map((p) => p.trim()).filter((p) => p !== '')
  if (parts.length === 0) throw new Error('table name is required')
  return parts.map((part) => quoteIdent(part, dialect)).join('.')
}

const NUMBER_RE = /^[+-]?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/
const INT_RE = /^[+-]?(?:0|[1-9]\d*)$/
const BOOL_RE = /^(?:true|false)$/i

export function quoteLiteral(value: string, dialect: Dialect): string {
  if (dialect === 'mysql') {
    return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "''")}'`
  }
  const escaped = value.replace(/'/g, "''")
  // MSSQL needs the N prefix for anything outside the code page
  if (dialect === 'mssql' && /[^\u0020-\u007E]/.test(value)) return `N'${escaped}'`
  return `'${escaped}'`
}

export function formatValue(value: string, dialect: Dialect, nullToken: string): string {
  if (value === nullToken) return 'NULL'
  if (NUMBER_RE.test(value)) return value
  if (BOOL_RE.test(value)) {
    const truthy = value.toLowerCase() === 'true'
    if (dialect === 'mssql' || dialect === 'sqlite') return truthy ? '1' : '0'
    return truthy ? 'TRUE' : 'FALSE'
  }
  return quoteLiteral(value, dialect)
}

const TYPES: Record<Dialect, { int: string; num: string; bool: string; text: string }> = {
  ansi: { int: 'INTEGER', num: 'DECIMAL(18,6)', bool: 'BOOLEAN', text: 'VARCHAR(255)' },
  postgres: { int: 'INTEGER', num: 'NUMERIC', bool: 'BOOLEAN', text: 'TEXT' },
  mysql: { int: 'INT', num: 'DECIMAL(18,6)', bool: 'BOOLEAN', text: 'TEXT' },
  mssql: { int: 'INT', num: 'DECIMAL(18,6)', bool: 'BIT', text: 'NVARCHAR(255)' },
  sqlite: { int: 'INTEGER', num: 'REAL', bool: 'INTEGER', text: 'TEXT' }
}

export function inferType(values: string[], dialect: Dialect, nullToken: string): string {
  const t = TYPES[dialect]
  const present = values.filter((v) => v !== nullToken)
  if (present.length === 0) return t.text
  if (present.every((v) => INT_RE.test(v))) return t.int
  if (present.every((v) => NUMBER_RE.test(v))) return t.num
  if (present.every((v) => BOOL_RE.test(v))) return t.bool
  return t.text
}

const util: Utility = {
  id: 'csv_to_sql',
  name: 'csv to sql insert',
  category: 'Data Formats',
  description:
    'Turn CSV into INSERT statements for ansi, mysql, postgres, mssql or sqlite, with optional multi-row batching, a NULL token and a generated CREATE TABLE.',
  accepts: 'string',
  produces: 'string',
  tags: ['csv', 'sql', 'insert', 'postgres', 'mysql', 'database', 'ddl'],
  examples: [
    {
      title: 'CSV to postgres INSERT statements',
      input: 'name,email,age\nAda Lovelace,ada@example.com,36\nGrace Hopper,grace@example.com,85',
      params: { table: 'users', delimiter: 'auto', dialect: 'postgres', batch: false, nullToken: '', createTable: false },
      output:
        'INSERT INTO "users" ("name", "email", "age") VALUES (\'Ada Lovelace\', \'ada@example.com\', 36);\nINSERT INTO "users" ("name", "email", "age") VALUES (\'Grace Hopper\', \'grace@example.com\', 85);'
    }
  ],
  params: {
    table: { kind: 'string', label: 'table name', default: 'my_table', placeholder: 'my_table or schema.my_table' },
    delimiter: { kind: 'string', label: 'delimiter', default: 'auto', placeholder: 'auto, , ; | or \\t' },
    dialect: { kind: 'select', label: 'dialect', options: ['ansi', 'mysql', 'postgres', 'mssql', 'sqlite'], default: 'ansi' },
    batch: { kind: 'boolean', label: 'single multi-row insert', default: false },
    nullToken: { kind: 'string', label: 'null token', default: '', placeholder: 'empty cell = NULL' },
    createTable: { kind: 'boolean', label: 'emit CREATE TABLE', default: false }
  },
  apply: (input: any, { table, delimiter, dialect, batch, nullToken, createTable }: any) => {
    const text = String(input ?? '').replace(/^\uFEFF/, '')
    // an empty box is not an error the user needs to see yet
    if (text.trim() === '') return ''

    const tableName = String(table ?? 'my_table').trim()
    if (tableName === '') throw new Error('table name is required')

    const dia: Dialect = (['ansi', 'mysql', 'postgres', 'mssql', 'sqlite'] as const).includes(dialect)
      ? (dialect as Dialect)
      : 'ansi'

    const rawDelim = String(delimiter ?? 'auto')
    const delim = rawDelim === 'auto' || rawDelim === '' ? detectDelimiter(text) : unescapeDelimiter(rawDelim)

    const rows = parseCsv(text, delim)
    if (rows.length === 0) return ''

    const nullTok = String(nullToken ?? '')
    const headerRow = rows[0]
    const dataRows = rows.slice(1)
    const width = rows.reduce((m, r) => Math.max(m, r.length), 0)

    const columns = Array.from({ length: width }, (_, i) => {
      const name = (headerRow[i] ?? '').trim()
      return name === '' ? `column_${i + 1}` : name
    })

    const qTable = quoteQualifiedName(tableName, dia)
    const out: string[] = []

    if (createTable) {
      const defs = columns.map((c, i) => {
        const columnValues = dataRows.map((r) => r[i] ?? nullTok)
        return `  ${quoteIdent(c, dia)} ${inferType(columnValues, dia, nullTok)}`
      })
      out.push(`CREATE TABLE ${qTable} (\n${defs.join(',\n')}\n);`)
    }

    if (dataRows.length > 0) {
      const columnList = columns.map((c) => quoteIdent(c, dia)).join(', ')
      const tuples = dataRows.map((r) => {
        const padded = Array.from({ length: width }, (_, i) => r[i] ?? nullTok)
        return `(${padded.map((v) => formatValue(v, dia, nullTok)).join(', ')})`
      })
      if (batch) {
        out.push(`INSERT INTO ${qTable} (${columnList}) VALUES\n${tuples.map((t) => `  ${t}`).join(',\n')};`)
      } else {
        for (const t of tuples) out.push(`INSERT INTO ${qTable} (${columnList}) VALUES ${t};`)
      }
    }

    return out.join('\n')
  }
}

export default util
