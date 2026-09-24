import type { Utility } from '@/types/utility'

const SORT_MODES = ['count-desc', 'count-asc', 'alpha', 'original'] as const
const FORMATS = ['count-line', 'line-count', 'json'] as const

/** Escapes a user can type into a single-line param box. */
const ESCAPES: Record<string, string> = { n: '\n', r: '\r', t: '\t', '0': '\0', '\\': '\\' }

/**
 * Turn `\t`/`\n`-style text into the real character so a separator can be typed
 * into a one-line input. Unknown escapes (`\d`, a lone `\`) are left alone.
 */
function decodeEscapes(raw: unknown): string {
  if (raw === undefined || raw === null) return ''
  return String(raw).replace(/\\([nrt0\\])/g, (_m, c: string) => ESCAPES[c])
}

/**
 * Split into lines tolerating CRLF and lone CR, dropping the phantom empty
 * element a trailing newline produces — `"a\nb\n"` is two lines, not three.
 */
function splitLines(text: string): string[] {
  if (text === '') return []
  const body = text.replace(/(\r\n|\n|\r)$/, '')
  return body.split(/\r\n|\n|\r/)
}

/**
 * Order by code point rather than UTF-16 unit so astral characters (emoji) sort
 * after the BMP instead of in the middle of it. Used as the tie-break under
 * `compareAlpha`, where it keeps the ordering total and deterministic.
 */
function compareCodePoints(a: string, b: string): number {
  const A = Array.from(a)
  const B = Array.from(b)
  const n = Math.min(A.length, B.length)
  for (let i = 0; i < n; i++) {
    const x = A[i].codePointAt(0) as number
    const y = B[i].codePointAt(0) as number
    if (x !== y) return x < y ? -1 : 1
  }
  return A.length - B.length
}

/**
 * Dictionary order, matching the `line_sort` utility's alphabetical mode:
 * `apple` before `Banana`, not the ASCIIbetical `Banana` before `apple` that a
 * raw code-point comparison gives. Folds case when the user asked to ignore it,
 * so the sort agrees with the counting. Falls back to code points when the
 * collator calls two lines equal, keeping the order total and deterministic.
 */
function compareAlpha(a: string, b: string, fold: boolean): number {
  const A = fold ? a.toLowerCase() : a
  const B = fold ? b.toLowerCase() : b
  return A.localeCompare(B) || compareCodePoints(a, b)
}

type Tally = { line: string; count: number; order: number }

const util: Utility = {
  id: 'uniq_count',
  name: 'count duplicate lines',
  category: 'Lines',
  description:
    'Count how many times each line occurs, sorted by count or alphabetically, as count/line text or JSON.',
  accepts: 'string',
  produces: ['string', 'json'],
  params: {
    sort: {
      kind: 'select',
      label: 'sort',
      options: [...SORT_MODES],
      default: 'count-desc'
    },
    separator: { kind: 'string', label: 'separator', default: '\t', placeholder: '\\t' },
    ignoreCase: { kind: 'boolean', label: 'ignore case', default: false },
    trim: { kind: 'boolean', label: 'trim lines', default: false },
    onlyDuplicates: { kind: 'boolean', label: 'only duplicates', default: false },
    format: {
      kind: 'select',
      label: 'format',
      options: [...FORMATS],
      default: 'count-line'
    }
  },
  tags: ['uniq -c', 'count duplicates', 'line frequency', 'tally lines', 'value counts', 'histogram'],
  aliases: ['uniq -c'],
  examples: [
    { title: 'count-desc', input: 'a\nb\na\nc\nb\na', output: '3\ta\n2\tb\n1\tc' },
    { title: 'json', input: 'a\nb\na\nc\nb\na', params: { format: 'json' }, output: '{\n  "totalLines": 6,\n  "uniqueLines": 3,\n  "entries": [\n    {\n      "line": "a",\n      "count": 3\n    },\n    {\n      "line": "b",\n      "count": 2\n    },\n    {\n      "line": "c",\n      "count": 1\n    }\n  ]\n}' }
  ],
  apply: (input: any, params: any): any => {
    const p = params ?? {}
    const sort = String(p.sort ?? 'count-desc')
    const format = String(p.format ?? 'count-line')
    if (!(SORT_MODES as readonly string[]).includes(sort)) {
      throw new Error(`unknown sort "${sort}" — use ${SORT_MODES.join(', ')}`)
    }
    if (!(FORMATS as readonly string[]).includes(format)) {
      throw new Error(`unknown format "${format}" — use ${FORMATS.join(', ')}`)
    }
    const separator = decodeEscapes(p.separator ?? '\t')
    const ignoreCase = p.ignoreCase === true
    const trimLines = p.trim === true
    const onlyDuplicates = p.onlyDuplicates === true

    const tallies = new Map<string, Tally>()
    let total = 0
    let order = 0
    for (const raw of splitLines(String(input))) {
      const line = trimLines ? raw.trim() : raw
      const key = ignoreCase ? line.toLowerCase() : line
      total++
      const hit = tallies.get(key)
      if (hit) hit.count++
      else tallies.set(key, { line, count: 1, order: order++ })
    }

    let entries = [...tallies.values()]
    if (onlyDuplicates) entries = entries.filter(e => e.count > 1)

    entries.sort((a, b) => {
      switch (sort) {
        case 'count-desc':
          return b.count - a.count || a.order - b.order
        case 'count-asc':
          return a.count - b.count || a.order - b.order
        case 'alpha':
          return compareAlpha(a.line, b.line, ignoreCase) || a.order - b.order
        default:
          return a.order - b.order
      }
    })

    if (format === 'json') {
      return {
        totalLines: total,
        uniqueLines: tallies.size,
        entries: entries.map(e => ({ line: e.line, count: e.count }))
      }
    }

    return entries
      .map(e =>
        format === 'line-count'
          ? `${e.line}${separator}${e.count}`
          : `${e.count}${separator}${e.line}`
      )
      .join('\n')
  }
}

export default util
