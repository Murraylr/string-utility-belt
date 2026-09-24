import type { Utility } from '@/types/utility'

const FORMATS = ['table', 'json'] as const
const UNITS = ['words', 'characters'] as const

const cpLength = (s: string) => Array.from(s).length
const padRight = (s: string, width: number) => s + ' '.repeat(Math.max(0, width - cpLength(s)))
const padLeft = (s: string, width: number) => ' '.repeat(Math.max(0, width - cpLength(s))) + s

/** Max of a list without spreading it — `Math.max(...xs)` blows the stack past ~125k args. */
const maxOf = (values: number[]): number => {
  let max = 0
  for (const v of values) if (v > max) max = v
  return max
}

const asCount = (value: unknown, fallback: number, label: string): number => {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return fallback
  if (n < 0) throw new Error(`${label} must be 0 or greater`)
  return Math.floor(n)
}

/**
 * Words, keeping internal apostrophes and hyphens; punctuation is dropped.
 * Combining marks (\p{M}) are allowed after the first character so decomposed
 * text — "nai" + U+0308 + "ve" — is one word, not two.
 */
const WORD_RE = /[\p{L}\p{N}][\p{L}\p{N}\p{M}]*(?:['’-][\p{L}\p{N}][\p{L}\p{N}\p{M}]*)*/gu

const tokenizeWords = (text: string): string[] => text.match(WORD_RE) ?? []

const util: Utility = {
  id: 'ngram_frequency',
  name: 'n-gram frequency',
  category: 'Analysis',
  description:
    'Count the most common n-grams of words or characters, with a configurable n, top n limit, case folding, and table or JSON output.',
  accepts: 'string',
  produces: ['string', 'json'],
  tags: ['n-gram', 'bigram', 'trigram', 'markov', 'text analysis', 'collocations'],
  params: {
    n: { kind: 'number', label: 'n (size of each gram)', default: 2, min: 1, integer: true, max: 100 },
    unit: { kind: 'select', label: 'unit', options: ['words', 'characters'], default: 'words' },
    top: { kind: 'number', label: 'top n (0 = all)', default: 20, min: 0, integer: true },
    ignoreCase: { kind: 'boolean', label: 'ignore case', default: true },
    format: { kind: 'select', label: 'format', options: ['table', 'json'], default: 'table' }
  },
  examples: [
    {
      title: 'top word bigrams',
      input: 'the cat sat on the mat',
      params: { n: 2, top: 3 },
      output: 'cat sat  1\non the   1\nsat on   1'
    }
  ],
  apply: (input: any, params: any) => {
    const format = String(params?.format ?? 'table')
    if (!(FORMATS as readonly string[]).includes(format)) {
      throw new Error(`unknown format: ${format} (expected table or json)`)
    }
    const unit = String(params?.unit ?? 'words')
    if (!(UNITS as readonly string[]).includes(unit)) {
      throw new Error(`unknown unit: ${unit} (expected words or characters)`)
    }
    const rawN = typeof params?.n === 'number' ? params.n : Number(params?.n)
    const n = Number.isFinite(rawN) ? Math.floor(rawN) : 2
    if (n < 1) throw new Error('n must be 1 or greater')
    const top = asCount(params?.top, 20, 'top')
    const ignoreCase = params?.ignoreCase !== false

    let text = String(input ?? '')
    if (ignoreCase) text = text.toLowerCase()

    // Code points, never UTF-16 units, so emoji survive as single characters.
    const units = unit === 'words' ? tokenizeWords(text) : Array.from(text)
    const joiner = unit === 'words' ? ' ' : ''

    const counts = new Map<string, number>()
    let totalNgrams = 0
    for (let i = 0; i + n <= units.length; i++) {
      const gram = units.slice(i, i + n).join(joiner)
      counts.set(gram, (counts.get(gram) ?? 0) + 1)
      totalNgrams++
    }

    const rows = Array.from(counts, ([ngram, count]) => ({ ngram, count })).sort(
      (a, b) => b.count - a.count || (a.ngram < b.ngram ? -1 : a.ngram > b.ngram ? 1 : 0)
    )
    const shown = top > 0 ? rows.slice(0, top) : rows

    if (format === 'json') {
      return { n, unit, totalNgrams, uniqueNgrams: rows.length, ngrams: shown }
    }
    if (shown.length === 0) return ''
    const gramWidth = maxOf(shown.map((r) => cpLength(r.ngram)))
    const countWidth = maxOf(shown.map((r) => String(r.count).length))
    return shown
      .map((r) => `${padRight(r.ngram, gramWidth)}  ${padLeft(String(r.count), countWidth)}`)
      .join('\n')
  }
}

export default util
