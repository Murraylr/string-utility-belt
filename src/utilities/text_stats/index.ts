import type { Utility } from '@/types/utility'

type Stats = {
  characters: number
  charactersNoSpaces: number
  graphemes: number
  words: number
  uniqueWords: number
  sentences: number
  paragraphs: number
  lines: number
  nonEmptyLines: number
  bytesUtf8: number
  bytesUtf16: number
  avgWordLength: number
  avgWordsPerSentence: number
  longestWord: string
  longestLine: number
}

const FORMATS = ['json', 'text'] as const

const round2 = (n: number) => (Number.isFinite(n) ? Math.round(n * 100) / 100 : 0)

/** Code-point length (never splits an astral character in half). */
const cpLength = (s: string) => Array.from(s).length

/** Unicode-aware right pad used by the text report. */
const padRight = (s: string, width: number) => s + ' '.repeat(Math.max(0, width - cpLength(s)))

type SegmenterCtor = new (
  locale?: string,
  options?: { granularity?: string }
) => { segment(input: string): Iterable<unknown> }

/** Grapheme clusters via Intl.Segmenter when present, else code points. */
const countGraphemes = (s: string): number => {
  if (s === '') return 0
  const Segmenter = (Intl as unknown as { Segmenter?: SegmenterCtor }).Segmenter
  if (typeof Segmenter === 'function') {
    try {
      return Array.from(new Segmenter(undefined, { granularity: 'grapheme' }).segment(s)).length
    } catch {
      // fall through to the code-point count
    }
  }
  return cpLength(s)
}

/**
 * Trim leading/trailing punctuation so `"word,"` measures as `word`.
 * Combining marks (\p{M}) are kept at the trailing edge so decomposed text —
 * `cafe` + U+0301 — keeps its accent instead of being measured as `cafe`.
 */
const stripEdges = (w: string) =>
  w.replace(/^[^\p{L}\p{N}]+/u, '').replace(/(?<![^\p{L}\p{N}\p{M}])[^\p{L}\p{N}\p{M}]+$/u, '')

/**
 * Sentence terminator, optionally followed by closing quotes so
 * `He said "hi." Then left.` counts as two sentences. Closing brackets are
 * deliberately excluded — `Wait (really!) now.` is one sentence, not two.
 */
// the lookbehind lets a match start only where a run of terminators starts (linear)
const SENTENCE_END = /(?<![.!?…])[.!?…]+["'”’»›]*(?=\s|$)/u

const countSentences = (text: string): number => {
  const trimmed = text.trim()
  if (trimmed === '') return 0
  const parts = trimmed
    .split(SENTENCE_END)
    .map((p) => p.trim())
    .filter(Boolean)
  // Text made only of terminators (e.g. "...") still counts as one sentence.
  return parts.length === 0 ? 1 : parts.length
}

export function computeTextStats(input: string): Stats {
  const s = input
  const nl = s.replace(/\r\n?/g, '\n')
  const lines = s === '' ? [] : nl.split('\n')
  // Whitespace-separated runs, then only those holding a letter or digit: a bare
  // `-` or `...` is not a word, so it must not inflate `words` while contributing
  // nothing to uniqueWords / avgWordLength / longestWord.
  const tokens = s.match(/\S+/gu) ?? []
  const cleaned = tokens.map(stripEdges).filter(Boolean)

  let longestWord = ''
  let longestWordLen = 0
  let totalWordLen = 0
  for (const w of cleaned) {
    const len = cpLength(w)
    totalWordLen += len
    if (len > longestWordLen) {
      longestWordLen = len
      longestWord = w
    }
  }

  let longestLine = 0
  let nonEmptyLines = 0
  for (const line of lines) {
    const len = cpLength(line)
    if (len > longestLine) longestLine = len
    if (line.trim() !== '') nonEmptyLines++
  }

  const sentences = countSentences(nl)

  return {
    characters: s.length,
    charactersNoSpaces: s.replace(/\s/gu, '').length,
    graphemes: countGraphemes(s),
    words: cleaned.length,
    uniqueWords: new Set(cleaned.map((w) => w.toLowerCase())).size,
    sentences,
    paragraphs: nl
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter(Boolean).length,
    lines: lines.length,
    nonEmptyLines,
    bytesUtf8: new TextEncoder().encode(s).length,
    bytesUtf16: s.length * 2,
    avgWordLength: cleaned.length ? round2(totalWordLen / cleaned.length) : 0,
    avgWordsPerSentence: sentences ? round2(cleaned.length / sentences) : 0,
    longestWord,
    longestLine
  }
}

const TEXT_ROWS: [keyof Stats, string][] = [
  ['characters', 'characters'],
  ['charactersNoSpaces', 'characters (no spaces)'],
  ['graphemes', 'graphemes'],
  ['words', 'words'],
  ['uniqueWords', 'unique words'],
  ['sentences', 'sentences'],
  ['paragraphs', 'paragraphs'],
  ['lines', 'lines'],
  ['nonEmptyLines', 'non-empty lines'],
  ['bytesUtf8', 'bytes (utf-8)'],
  ['bytesUtf16', 'bytes (utf-16)'],
  ['avgWordLength', 'avg word length'],
  ['avgWordsPerSentence', 'avg words per sentence'],
  ['longestWord', 'longest word'],
  ['longestLine', 'longest line (chars)']
]

export function statsToText(stats: Stats): string {
  const width = Math.max(...TEXT_ROWS.map(([, label]) => cpLength(label)))
  return TEXT_ROWS.map(([key, label]) => `${padRight(label + ':', width + 1)} ${String(stats[key])}`).join('\n')
}

const util: Utility = {
  id: 'text_stats',
  name: 'text statistics',
  category: 'Analysis',
  description:
    'Count characters, graphemes, words, sentences, paragraphs, lines and bytes, with averages and the longest word or line, as JSON or a plain-text report.',
  accepts: 'string',
  produces: ['json', 'string'],
  tags: ['word count', 'character count', 'paragraph count', 'stats', 'readability metrics', 'grapheme count'],
  aliases: ['wc'],
  params: {
    format: { kind: 'select', label: 'format', options: ['json', 'text'], default: 'json' }
  },
  examples: [
    {
      title: 'a short paragraph',
      input: 'Hello world. This is great!',
      output: JSON.stringify(
        {
          characters: 27,
          charactersNoSpaces: 23,
          graphemes: 27,
          words: 5,
          uniqueWords: 5,
          sentences: 2,
          paragraphs: 1,
          lines: 1,
          nonEmptyLines: 1,
          bytesUtf8: 27,
          bytesUtf16: 54,
          avgWordLength: 4.2,
          avgWordsPerSentence: 2.5,
          longestWord: 'Hello',
          longestLine: 27
        },
        null,
        2
      )
    }
  ],
  apply: (input: any, params: any) => {
    const format = String(params?.format ?? 'json')
    if (!(FORMATS as readonly string[]).includes(format)) {
      throw new Error(`unknown format: ${format} (expected json or text)`)
    }
    const stats = computeTextStats(String(input ?? ''))
    return format === 'text' ? statsToText(stats) : stats
  }
}

export default util
