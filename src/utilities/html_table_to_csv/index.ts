import type { Utility } from '@/types/utility'

/** Turn a user-typed delimiter (`\t`, `\|`, `\\`, …) into the real character(s). */
const unescapeDelimiter = (raw: string): string =>
  raw.replace(/\\(.)/g, (_m, c: string) =>
    c === 't' ? '\t' : c === 'n' ? '\n' : c === 'r' ? '\r' : c
  )

// U+0000 can never survive HTML parsing (the spec rewrites it to U+FFFD),
// so it is a safe stand-in for the line breaks that <br> introduces.
const BR = String.fromCharCode(0)

/** `<br>` becomes a newline; all other HTML whitespace collapses, as it renders. */
export function cellText(el: Element): string {
  const clone = el.cloneNode(true) as Element
  const doc = el.ownerDocument
  if (doc) {
    for (const br of Array.from(clone.querySelectorAll('br'))) {
      br.parentNode?.replaceChild(doc.createTextNode(BR), br)
    }
  }
  const raw = clone.textContent ?? ''
  return raw
    .replace(/\s+/g, ' ')
    .split(BR)
    .map((line) => line.trim())
    .join('\n')
    .trim()
}

/** RFC 4180 field quoting for an arbitrary delimiter. */
export function quoteField(value: string, delimiter: string): string {
  const needsQuotes =
    value.includes('"') ||
    value.includes('\n') ||
    value.includes('\r') ||
    (delimiter.length > 0 && value.includes(delimiter)) ||
    /^\s|\s$/.test(value)
  return needsQuotes ? `"${value.replace(/"/g, '""')}"` : value
}

const isCell = (el: Element) => el.tagName === 'TD' || el.tagName === 'TH'

const util: Utility = {
  id: 'html_table_to_csv',
  name: 'html table to csv',
  category: 'Data Formats',
  description:
    'Extract the nth HTML <table> as CSV, expanding colspan across columns and using any delimiter you choose.',
  accepts: 'string',
  produces: 'string',
  tags: ['html', 'table', 'csv', 'scrape', 'extract table', 'colspan', 'convert'],
  examples: [
    {
      title: 'simple table with header',
      input:
        '<table><tr><th>Name</th><th>Age</th></tr><tr><td>Ada</td><td>36</td></tr><tr><td>Grace</td><td>85</td></tr></table>',
      output: 'Name,Age\nAda,36\nGrace,85'
    },
    {
      title: 'custom delimiter, quoted cell',
      input: '<table><tr><td>a;b</td><td>c</td></tr></table>',
      params: { delimiter: ';' },
      output: '"a;b";c'
    }
  ],
  params: {
    tableIndex: { kind: 'number', label: 'table index (0-based)', default: 0, integer: true },
    delimiter: { kind: 'string', label: 'delimiter', default: ',', placeholder: ', ; | or \\t' }
  },
  apply: (input: any, { tableIndex, delimiter }: any) => {
    const html = String(input ?? '')
    // an empty box is not an error the user needs to see yet
    if (html.trim() === '') return ''

    const delim = unescapeDelimiter(String(delimiter ?? ',')) || ','

    const doc = new DOMParser().parseFromString(html, 'text/html')
    const tables = Array.from(doc.querySelectorAll('table'))
    if (tables.length === 0) throw new Error('no <table> found in the input')

    let idx = Math.trunc(Number(tableIndex ?? 0) || 0)
    if (idx < 0) idx += tables.length
    if (idx < 0 || idx >= tables.length) {
      throw new Error(`table index ${tableIndex} out of range (found ${tables.length} table${tables.length === 1 ? '' : 's'})`)
    }
    const table = tables[idx]

    // rows of nested tables belong to the nested table, not this one
    const trs = Array.from(table.querySelectorAll('tr')).filter((tr) => tr.closest('table') === table)

    const grid: string[][] = []
    for (const tr of trs) {
      const cells = Array.from(tr.children).filter(isCell)
      if (cells.length === 0) continue
      const row: string[] = []
      for (const cell of cells) {
        const text = cellText(cell)
        const span = Math.max(1, Math.trunc(Number(cell.getAttribute('colspan') ?? 1) || 1))
        // a spanning cell fills every column it covers so columns stay aligned
        for (let s = 0; s < span; s++) row.push(text)
      }
      grid.push(row)
    }
    if (grid.length === 0) return ''

    const width = grid.reduce((m, r) => Math.max(m, r.length), 0)
    return grid
      .map((row) => {
        const padded = row.slice()
        while (padded.length < width) padded.push('')
        return padded.map((v) => quoteField(v, delim)).join(delim)
      })
      .join('\n')
  }
}

export default util
