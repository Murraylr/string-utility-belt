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

/** Split into words on case boundaries and non-alphanumerics (Unicode aware). */
function splitWords(s: string): string[] {
  return s
    .trim()
    .replace(/([\p{Ll}\p{N}])(\p{Lu})/gu, '$1 $2')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
}

/** Upper-case the first code point — never splits an astral character. */
function capitalize(word: string): string {
  const cps = Array.from(word)
  if (cps.length === 0) return ''
  return cps[0].toUpperCase() + cps.slice(1).join('')
}

function styleName(raw: string, style: string): string {
  if (style === 'lower') return raw.trim().toLowerCase()
  if (style === 'upper') return raw.trim().toUpperCase()
  const words = splitWords(raw)
  if (words.length === 0) return ''
  switch (style) {
    case 'camel':
      return words
        .map((w, i) => (i === 0 ? w.toLowerCase() : capitalize(w.toLowerCase())))
        .join('')
    case 'pascal':
      return words.map((w) => capitalize(w.toLowerCase())).join('')
    case 'kebab':
      return words.map((w) => w.toLowerCase()).join('-')
    case 'title':
      return words.map((w) => capitalize(w.toLowerCase())).join(' ')
    case 'snake':
    default:
      return words.map((w) => w.toLowerCase()).join('_')
  }
}

/** The separator a de-duplicating counter should use for each style. */
function dedupeSuffix(style: string, n: number): string {
  switch (style) {
    case 'camel':
    case 'pascal':
      return String(n)
    case 'kebab':
      return '-' + n
    case 'title':
      return ' ' + n
    default:
      return '_' + n
  }
}

const util: Utility = {
  id: 'csv_normalize_headers',
  name: 'csv normalize headers',
  category: 'Data Formats',
  description:
    'Rewrite the CSV header row to snake, camel, kebab, pascal, title, lower, or upper case, optionally de-duplicating repeated names.',
  accepts: 'string',
  produces: 'string',
  tags: ['csv', 'headers', 'snake case', 'camel case', 'rename', 'columns', 'normalize'],
  examples: [
    {
      title: 'title case headers to snake_case',
      input: 'First Name,Last Name\nAda,Lovelace',
      params: { style: 'snake', delimiter: 'auto', dedupe: true },
      output: 'first_name,last_name\nAda,Lovelace'
    }
  ],
  params: {
    style: {
      kind: 'select',
      label: 'style',
      options: ['snake', 'camel', 'kebab', 'pascal', 'title', 'lower', 'upper'],
      default: 'snake'
    },
    delimiter: {
      kind: 'string',
      label: 'delimiter',
      default: 'auto',
      placeholder: 'auto, , ; \\t'
    },
    dedupe: {
      kind: 'boolean',
      label: 'de-duplicate names',
      default: true
    }
  },
  apply: (input: any, { style = 'snake', delimiter = 'auto', dedupe = true }: any = {}) => {
    const text = String(input ?? '')
    if (text.trim() === '') return ''

    const delim = resolveDelimiter(delimiter, text)
    const rows = parseCsv(text, delim)
    if (rows.length === 0) return ''

    const used = new Set<string>()
    const headers = rows[0].map((cell, index) => {
      let base = styleName(cell, style)
      if (base === '') base = styleName(`column_${index + 1}`, style)
      if (dedupe === false) return base
      let name = base
      let n = 2
      while (used.has(name.toLowerCase())) {
        name = base + dedupeSuffix(style, n)
        n++
      }
      used.add(name.toLowerCase())
      return name
    })

    const out = [headers, ...rows.slice(1)]
    const eol = /\r\n/.test(text) ? '\r\n' : '\n'
    const trailing = /(\r\n|\n|\r)$/.test(text) ? eol : ''
    return (
      out.map((row) => row.map((cell) => csvField(cell, delim)).join(delim)).join(eol) + trailing
    )
  }
}

export default util
