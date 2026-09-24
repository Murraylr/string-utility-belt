import type { Utility } from '@/types/utility'

const FORMATS = ['table', 'json', 'csv'] as const

const cpLength = (s: string) => Array.from(s).length
const padRight = (s: string, width: number) => s + ' '.repeat(Math.max(0, width - cpLength(s)))
const padLeft = (s: string, width: number) => ' '.repeat(Math.max(0, width - cpLength(s))) + s

/** Max of a list without spreading it — `Math.max(...xs)` blows the stack past ~125k args. */
const maxOf = (values: number[]): number => {
  let max = 0
  for (const v of values) if (v > max) max = v
  return max
}

/**
 * Lower-case a single character, but only when it stays a single code point.
 * "İ".toLowerCase() is "i" + U+0307, which would put a two-code-point entry in a
 * per-character table and label it with the first code point only.
 */
const foldCase = (ch: string): string => {
  const lower = ch.toLowerCase()
  return cpLength(lower) === 1 ? lower : ch
}

/**
 * Characters with no visible glyph: controls (C0/C1), format characters
 * (zero-width space/joiner, BOM, word joiner, soft hyphen, bidi controls),
 * lone surrogates, private use, and line/paragraph separators.
 */
const INVISIBLE = /[\p{Cc}\p{Cf}\p{Cs}\p{Co}\p{Zl}\p{Zp}]/u

const csvCell = (v: string) =>
  /[",\r\n]/.test(v) || v !== v.trim() ? `"${v.replace(/"/g, '""')}"` : v

const asCount = (value: unknown, fallback: number, label: string): number => {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return fallback
  if (n < 0) throw new Error(`${label} must be 0 or greater`)
  return Math.floor(n)
}

export const codePointLabel = (ch: string): string =>
  `U+${(ch.codePointAt(0) ?? 0).toString(16).toUpperCase().padStart(4, '0')}`

/** Printable stand-in for characters that would be invisible in a table. */
export function displayChar(ch: string): string {
  switch (ch) {
    case '\n':
      return '\\n'
    case '\r':
      return '\\r'
    case '\t':
      return '\\t'
    case '\f':
      return '\\f'
    case '\v':
      return '\\v'
    case ' ':
      return '␣'
  }
  const cp = ch.codePointAt(0) ?? 0
  if (cp < 0x20 || cp === 0x7f || INVISIBLE.test(ch) || /\s/u.test(ch)) return codePointLabel(ch)
  return ch
}

const util: Utility = {
  id: 'char_frequency',
  name: 'character frequency',
  category: 'Analysis',
  description:
    'Count how often each character occurs, with options to fold case, include whitespace, show percentages, limit to the top n, and output a table, JSON or CSV.',
  accepts: 'string',
  produces: ['string', 'json'],
  tags: ['character count', 'letter frequency', 'histogram', 'frequency table', 'distribution', 'code point count'],
  params: {
    top: { kind: 'number', label: 'top n (0 = all)', default: 0, min: 0, integer: true },
    ignoreCase: { kind: 'boolean', label: 'ignore case', default: false },
    includeWhitespace: { kind: 'boolean', label: 'include whitespace', default: false },
    format: { kind: 'select', label: 'format', options: ['table', 'json', 'csv'], default: 'table' },
    percent: { kind: 'boolean', label: 'show percent', default: true }
  },
  examples: [
    {
      title: 'top 3 letters',
      input: 'banana',
      params: { top: 3 },
      output: 'a  3  50.00%\nn  2  33.33%\nb  1  16.67%'
    },
    {
      title: 'case-folded, as json',
      input: 'AaBb',
      params: { ignoreCase: true, format: 'json' },
      output: JSON.stringify(
        {
          totalCharacters: 4,
          uniqueCharacters: 2,
          characters: [
            { char: 'a', codePoint: 'U+0061', count: 2, percent: 50 },
            { char: 'b', codePoint: 'U+0062', count: 2, percent: 50 }
          ]
        },
        null,
        2
      )
    }
  ],
  apply: (input: any, params: any) => {
    const format = String(params?.format ?? 'table')
    if (!(FORMATS as readonly string[]).includes(format)) {
      throw new Error(`unknown format: ${format} (expected table, json or csv)`)
    }
    const top = asCount(params?.top, 0, 'top')
    const ignoreCase = params?.ignoreCase === true
    const includeWhitespace = params?.includeWhitespace === true
    const showPercent = params?.percent !== false

    const text = String(input ?? '')
    const counts = new Map<string, number>()
    let total = 0

    // Iterate code points so astral characters (emoji) stay whole.
    for (const raw of Array.from(text)) {
      if (!includeWhitespace && /\s/u.test(raw)) continue
      const ch = ignoreCase ? foldCase(raw) : raw
      counts.set(ch, (counts.get(ch) ?? 0) + 1)
      total++
    }

    const rows = Array.from(counts, ([char, count]) => ({
      char,
      codePoint: codePointLabel(char),
      count,
      percent: total ? Math.round((count / total) * 10000) / 100 : 0
    })).sort(
      (a, b) =>
        b.count - a.count ||
        (a.char.codePointAt(0) ?? 0) - (b.char.codePointAt(0) ?? 0)
    )
    const shown = top > 0 ? rows.slice(0, top) : rows

    if (format === 'json') {
      return {
        totalCharacters: total,
        uniqueCharacters: rows.length,
        characters: shown.map((r) =>
          showPercent ? r : { char: r.char, codePoint: r.codePoint, count: r.count }
        )
      }
    }
    if (shown.length === 0) return ''

    const percentText = (p: number) => `${p.toFixed(2)}%`

    if (format === 'csv') {
      const header = showPercent ? 'char,codePoint,count,percent' : 'char,codePoint,count'
      return [
        header,
        ...shown.map((r) =>
          showPercent
            ? `${csvCell(r.char)},${r.codePoint},${r.count},${r.percent.toFixed(2)}`
            : `${csvCell(r.char)},${r.codePoint},${r.count}`
        )
      ].join('\n')
    }

    const display = shown.map((r) => displayChar(r.char))
    const charWidth = maxOf(display.map(cpLength))
    const countWidth = maxOf(shown.map((r) => String(r.count).length))
    const percentWidth = showPercent ? maxOf(shown.map((r) => percentText(r.percent).length)) : 0
    return shown
      .map((r, i) => {
        const base = `${padRight(display[i], charWidth)}  ${padLeft(String(r.count), countWidth)}`
        return showPercent ? `${base}  ${padLeft(percentText(r.percent), percentWidth)}` : base
      })
      .join('\n')
  }
}

export default util
