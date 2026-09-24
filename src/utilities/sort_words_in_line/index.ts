import type { Utility } from '@/types/utility'

type Direction = 'asc' | 'desc'

/** Interpret the backslash escapes a single-line text input cannot carry literally. */
function unescape(s: string): string {
  return s.replace(/\\([tnr\\])/g, (_m, c: string) =>
    c === 't' ? '\t' : c === 'n' ? '\n' : c === 'r' ? '\r' : '\\'
  )
}

/** Code-point order, so astral characters compare as whole characters. */
function codePointCompare(a: string, b: string): number {
  const ax = Array.from(a)
  const bx = Array.from(b)
  const len = Math.min(ax.length, bx.length)
  for (let i = 0; i < len; i++) {
    const d = (ax[i].codePointAt(0) as number) - (bx[i].codePointAt(0) as number)
    if (d !== 0) return d < 0 ? -1 : 1
  }
  return ax.length - bx.length
}

function boolParam(v: unknown, name: string, dflt: boolean): boolean {
  if (v === undefined || v === null || v === '') return dflt
  if (typeof v === 'boolean') return v
  if (v === 'true') return true
  if (v === 'false') return false
  throw new Error(`${name} must be true or false (got "${String(v)}")`)
}

function selectParam<T extends string>(v: unknown, name: string, options: readonly T[], dflt: T): T {
  if (v === undefined || v === null || v === '') return dflt
  const s = String(v)
  if (!(options as readonly string[]).includes(s)) {
    throw new Error(`${name} must be one of ${options.join(', ')} (got "${s}")`)
  }
  return s as T
}

const util: Utility = {
  id: 'sort_words_in_line',
  name: 'sort words in each line',
  category: 'Lines',
  description:
    'Sort the words within every line, ascending or descending, on any separator, optionally case-insensitively and dropping duplicates.',
  accepts: 'string',
  produces: 'string',
  params: {
    direction: { kind: 'select', label: 'direction', options: ['asc', 'desc'], default: 'asc' },
    separator: { kind: 'string', label: 'word separator', default: ' ', placeholder: '" ", "," or "\\t"' },
    unique: { kind: 'boolean', label: 'remove duplicate words', default: false },
    ignoreCase: { kind: 'boolean', label: 'ignore case', default: true }
  },
  tags: ['sort words', 'word order', 'alphabetize words in line', 'arrange words', 'reorder words'],
  examples: [
    { title: 'ascending', input: 'banana apple cherry', output: 'apple banana cherry' },
    { title: 'unique words', input: 'c b a b', params: { unique: true }, output: 'a b c' }
  ],
  apply: (input: any, params: any) => {
    const p = params ?? {}
    const direction = selectParam<Direction>(p.direction, 'direction', ['asc', 'desc'] as const, 'asc')
    const unique = boolParam(p.unique, 'unique', false)
    const ignoreCase = boolParam(p.ignoreCase, 'ignoreCase', true)
    const separator = unescape(p.separator === undefined || p.separator === null ? ' ' : String(p.separator))
    if (separator === '') {
      throw new Error('separator must not be empty')
    }

    const s = String(input)
    if (s === '') return ''

    // Preserve the document's line ending style and whether it ended with one.
    const eol = s.includes('\r\n') ? '\r\n' : !s.includes('\n') && s.includes('\r') ? '\r' : '\n'
    const trailing = /(?:\r\n|\n|\r)$/.exec(s)
    const body = trailing ? s.slice(0, s.length - trailing[0].length) : s

    // A whitespace separator means "words", so runs of it do not create empty
    // words; any other separator keeps empty fields, which are real data there.
    const separatorIsBlank = separator.trim() === ''
    const fold = (w: string) => (ignoreCase ? w.toLowerCase() : w)
    // Both paths order by code point: `ignoreCase` must change how case is treated and
    // nothing else. Locale collation would make the output depend on the machine's
    // locale and would rank astral characters by collation weight rather than code
    // point, so the same words would come out in a different order on the two paths.
    const compare = (a: string, b: string) =>
      codePointCompare(fold(a), fold(b)) || codePointCompare(a, b)

    const out = body.split(/\r\n|\n|\r/).map((line) => {
      let words = line.split(separator)
      if (separatorIsBlank) words = words.filter((w) => w !== '')
      if (words.length === 0) return ''

      if (unique) {
        const seen = new Set<string>()
        words = words.filter((w) => {
          const key = fold(w)
          if (seen.has(key)) return false
          seen.add(key)
          return true
        })
      }

      words.sort(compare)
      if (direction === 'desc') words.reverse()
      return words.join(separator)
    })

    return out.join(eol) + (trailing ? eol : '')
  }
}

export default util
