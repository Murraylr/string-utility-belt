import type { Utility } from '@/types/utility'

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

/** True when the line holds a pipe that is not backslash-escaped. */
function hasTablePipe(line: string): boolean {
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '\\') {
      i++
      continue
    }
    if (line[i] === '|') return true
  }
  return false
}

/**
 * Split one table row into cells. Leading/trailing pipes are optional,
 * `\|` is an escaped literal pipe, and `<br>` becomes a real line break.
 */
function splitTableRow(line: string): string[] {
  const s = line.trim()
  const cells: string[] = []
  let cur = ''
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (c === '\\' && s[i + 1] === '|') {
      cur += '|'
      i++
      continue
    }
    if (c === '|') {
      cells.push(cur)
      cur = ''
      continue
    }
    cur += c
  }
  cells.push(cur)
  if (cells.length > 1 && s.startsWith('|')) cells.shift()
  if (cells.length > 1 && s.endsWith('|') && !s.endsWith('\\|')) cells.pop()
  return cells.map((cell) => cell.trim().replace(/<br\s*\/?>/gi, '\n'))
}

/** `---`, `:--`, `--:`, `:-:` — the alignment row that follows the header. */
function isSeparatorRow(cells: string[]): boolean {
  return cells.length > 0 && cells.every((cell) => /^:?-+:?$/.test(cell.trim()))
}

const util: Utility = {
  id: 'markdown_to_csv',
  name: 'markdown table to csv',
  category: 'Data Formats',
  description:
    'Convert a markdown pipe table (with or without outer pipes) to CSV with RFC 4180 quoting and your chosen delimiter.',
  accepts: 'string',
  produces: 'string',
  tags: ['markdown', 'csv', 'pipe table', 'md table', 'convert', 'extract table'],
  examples: [
    {
      title: 'pipe table with alignment row',
      input: '| Name | Age |\n| --- | --- |\n| Ada | 36 |\n| Grace | 85 |',
      output: 'Name,Age\nAda,36\nGrace,85'
    }
  ],
  params: {
    delimiter: {
      kind: 'string',
      label: 'delimiter',
      default: ',',
      placeholder: ', ; \\t'
    }
  },
  apply: (input: any, { delimiter = ',' }: any = {}) => {
    const text = String(input ?? '')
    if (text.trim() === '') return ''

    const delim = unescapeDelimiter(String(delimiter ?? ',')) || ','

    // Collect every contiguous run of lines that hold an unescaped pipe.
    const runs: string[][] = []
    let current: string[] = []
    for (const line of text.split(/\r\n|\n|\r/)) {
      if (hasTablePipe(line)) {
        current.push(line)
      } else if (current.length > 0) {
        runs.push(current)
        current = []
      }
    }
    if (current.length > 0) runs.push(current)
    if (runs.length === 0) {
      throw new Error('no markdown table found (expected a line containing "|")')
    }

    // Prefer the first run that carries an alignment row: a prose line with a
    // stray pipe ("cost | benefit below:") must not win over the real table.
    const parsedRuns = runs.map((run) => run.map(splitTableRow))
    let rows = parsedRuns.find((run) => run.some((cells) => isSeparatorRow(cells))) ?? parsedRuns[0]

    // The alignment row can sit at any index when prose with a pipe leads the
    // run; markdown always puts the header on the line directly above it, so
    // anything before that is prose and the alignment row itself is dropped.
    const sep = rows.findIndex((cells) => isSeparatorRow(cells))
    if (sep >= 0) rows = [...rows.slice(Math.max(0, sep - 1), sep), ...rows.slice(sep + 1)]
    if (rows.length === 0) return ''

    // Pad ragged rows so the CSV stays rectangular for the next step.
    const width = Math.max(...rows.map((cells) => cells.length))
    return rows
      .map((cells) => {
        const padded = cells.slice()
        while (padded.length < width) padded.push('')
        return padded.map((cell) => csvField(cell, delim)).join(delim)
      })
      .join('\n')
  }
}

export default util
