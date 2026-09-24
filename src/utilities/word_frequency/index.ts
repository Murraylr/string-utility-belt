import type { Utility } from '@/types/utility'

const FORMATS = ['table', 'json', 'csv'] as const

/** Common English stop words, matched case-insensitively with apostrophes normalized. */
const STOP_WORDS = new Set([
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'almost', 'also', 'am', 'among', 'an',
  'and', 'any', 'are', "aren't", 'as', 'at', 'be', 'because', 'been', 'before', 'being', 'below',
  'between', 'both', 'but', 'by', 'can', "can't", 'cannot', 'could', "couldn't", 'did', "didn't",
  'do', 'does', "doesn't", 'doing', "don't", 'down', 'during', 'each', 'either', 'else', 'few',
  'for', 'from', 'further', 'had', "hadn't", 'has', "hasn't", 'have', "haven't", 'having', 'he',
  "he's", 'her', 'here', "here's", 'hers', 'herself', 'him', 'himself', 'his', 'how', 'i', "i'd",
  "i'll", "i'm", "i've", 'if', 'in', 'into', 'is', "isn't", 'it', "it's", 'its', 'itself', 'just',
  "let's", 'me', 'more', 'most', 'must', 'my', 'myself', 'no', 'nor', 'not', 'of', 'off', 'on',
  'once', 'only', 'or', 'other', 'ought', 'our', 'ours', 'ourselves', 'out', 'over', 'own', 'same',
  'shall', 'she', "she's", 'should', "shouldn't", 'so', 'some', 'such', 'than', 'that', "that's",
  'the', 'their', 'theirs', 'them', 'themselves', 'then', 'there', "there's", 'these', 'they',
  "they're", 'this', 'those', 'through', 'to', 'too', 'under', 'until', 'up', 'very', 'was',
  "wasn't", 'we', "we're", 'were', "weren't", 'what', 'when', 'where', 'which', 'while', 'who',
  'whom', 'why', 'will', 'with', "won't", 'would', "wouldn't", 'you', "you're", "you've", 'your',
  'yours', 'yourself', 'yourselves'
])

const cpLength = (s: string) => Array.from(s).length
const padRight = (s: string, width: number) => s + ' '.repeat(Math.max(0, width - cpLength(s)))
const padLeft = (s: string, width: number) => ' '.repeat(Math.max(0, width - cpLength(s))) + s

/** Max of a list without spreading it — `Math.max(...xs)` blows the stack past ~125k args. */
const maxOf = (values: number[]): number => {
  let max = 0
  for (const v of values) if (v > max) max = v
  return max
}

const csvCell = (v: string) =>
  /[",\r\n]/.test(v) || v !== v.trim() ? `"${v.replace(/"/g, '""')}"` : v

const normalizeApostrophes = (s: string) => s.replace(/[’ʼ]/g, "'")

const asCount = (value: unknown, fallback: number, label: string): number => {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return fallback
  if (n < 0) throw new Error(`${label} must be 0 or greater`)
  return Math.floor(n)
}

/**
 * A word: starts with a letter or digit, may carry combining marks (\p{M}) so
 * decomposed text — "nai" + U+0308 + "ve" — stays one word instead of splitting
 * at the mark, and may contain internal apostrophes or hyphens ("don't",
 * "well-known").
 */
const WORD_RE = /[\p{L}\p{N}][\p{L}\p{N}\p{M}]*(?:['’-][\p{L}\p{N}][\p{L}\p{N}\p{M}]*)*/gu

/** Split into words. Keeps internal apostrophes and hyphens ("don't", "well-known"). */
export function tokenizeWords(text: string, stripPunctuation: boolean): string[] {
  if (stripPunctuation) {
    return text.match(WORD_RE) ?? []
  }
  return text.match(/\S+/gu) ?? []
}

const util: Utility = {
  id: 'word_frequency',
  name: 'word frequency',
  category: 'Analysis',
  description:
    'Count how often each word occurs, with options to fold case, drop stop words, set a minimum length, keep or strip punctuation, and output a table, JSON or CSV.',
  accepts: 'string',
  produces: ['string', 'json'],
  tags: ['word count', 'term frequency', 'stop words', 'tf', 'histogram', 'most common words'],
  examples: [
    {
      title: 'top 3 words',
      input: 'the cat sat on the mat the cat ran',
      params: { top: 3 },
      output: 'the  3\ncat  2\nmat  1'
    }
  ],
  params: {
    top: { kind: 'number', label: 'top n (0 = all)', default: 20, min: 0, integer: true },
    ignoreCase: { kind: 'boolean', label: 'ignore case', default: true },
    stopWords: { kind: 'boolean', label: 'remove stop words', default: false },
    minLength: { kind: 'number', label: 'min word length', default: 1, min: 0, integer: true },
    format: { kind: 'select', label: 'format', options: ['table', 'json', 'csv'], default: 'table' },
    stripPunctuation: { kind: 'boolean', label: 'strip punctuation', default: true }
  },
  apply: (input: any, params: any) => {
    const format = String(params?.format ?? 'table')
    if (!(FORMATS as readonly string[]).includes(format)) {
      throw new Error(`unknown format: ${format} (expected table, json or csv)`)
    }
    const top = asCount(params?.top, 20, 'top')
    const minLength = asCount(params?.minLength, 1, 'min word length')
    const ignoreCase = params?.ignoreCase !== false
    const removeStopWords = params?.stopWords === true
    const stripPunctuation = params?.stripPunctuation !== false

    const text = String(input ?? '')
    const counts = new Map<string, number>()
    let totalWords = 0

    for (const raw of tokenizeWords(text, stripPunctuation)) {
      if (cpLength(raw) < minLength) continue
      const lower = normalizeApostrophes(raw.toLowerCase())
      if (removeStopWords && STOP_WORDS.has(lower)) continue
      const key = ignoreCase ? raw.toLowerCase() : raw
      counts.set(key, (counts.get(key) ?? 0) + 1)
      totalWords++
    }

    const rows = Array.from(counts, ([word, count]) => ({ word, count })).sort(
      (a, b) => b.count - a.count || (a.word < b.word ? -1 : a.word > b.word ? 1 : 0)
    )
    const shown = top > 0 ? rows.slice(0, top) : rows

    if (format === 'json') {
      return { totalWords, uniqueWords: rows.length, words: shown }
    }
    if (shown.length === 0) return ''
    if (format === 'csv') {
      return ['word,count', ...shown.map((r) => `${csvCell(r.word)},${r.count}`)].join('\n')
    }
    const wordWidth = maxOf(shown.map((r) => cpLength(r.word)))
    const countWidth = maxOf(shown.map((r) => String(r.count).length))
    return shown
      .map((r) => `${padRight(r.word, wordWidth)}  ${padLeft(String(r.count), countWidth)}`)
      .join('\n')
  }
}

export default util
