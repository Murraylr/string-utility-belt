import type { Utility } from '@/types/utility'

/* Words: letters/digits/marks with internal `.`, `'`, `’`, `-` (so `3.5` and `don't` count once). */
const WORD_RE = /[\p{L}\p{N}\p{M}]+(?:[.'’-][\p{L}\p{N}\p{M}]+)*/gu

/* Scripts that are not space-separated: every code point reads as its own "word". */
const CJK_RE = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/gu

/**
 * Count words, walking code points so astral characters survive.
 * CJK/kana/hangul characters are counted individually because they are not
 * whitespace-delimited; everything else is counted as whitespace-delimited words.
 */
export function countWords(text: string): number {
  const cjk = text.match(CJK_RE)
  const cjkCount = cjk ? cjk.length : 0
  const rest = cjkCount ? text.replace(CJK_RE, ' ') : text
  const latin = rest.match(WORD_RE)
  return (latin ? latin.length : 0) + cjkCount
}

const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? '' : 's'}`

function humanDuration(minutes: number, seconds: number): string {
  if (minutes && seconds) return `${plural(minutes, 'minute')} ${plural(seconds, 'second')}`
  if (minutes) return plural(minutes, 'minute')
  if (seconds) return plural(seconds, 'second')
  return 'less than a second'
}

type Report = {
  words: number
  wordsPerMinute: number
  totalSeconds: number
  minutes: number
  seconds: number
  roundedMinutes: number
  duration: string
  text: string
}

function analyse(text: string, wpm: number): Report {
  const words = countWords(text)
  const totalSeconds = words === 0 ? 0 : Math.round((words / wpm) * 60)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  const roundedMinutes = words === 0 ? 0 : Math.max(1, Math.ceil(totalSeconds / 60))

  let label: string
  if (words === 0) label = ''
  else if (totalSeconds < 60) label = `less than a minute read (${plural(words, 'word')} at ${wpm} wpm)`
  else label = `${roundedMinutes} min read (${plural(words, 'word')} at ${wpm} wpm)`

  return {
    words,
    wordsPerMinute: wpm,
    totalSeconds,
    minutes,
    seconds,
    roundedMinutes,
    duration: words === 0 ? '' : humanDuration(minutes, seconds),
    text: label
  }
}

const util: Utility = {
  id: 'reading_time',
  name: 'reading time',
  category: 'Analysis',
  description:
    'Estimate how long the text takes to read at a configurable words-per-minute rate, as a one-line summary or json.',
  accepts: 'string',
  produces: ['string', 'json'],
  tags: ['estimated reading time', 'wpm', 'words per minute', 'medium reading time', 'article length'],
  params: {
    wordsPerMinute: { kind: 'number', label: 'words per minute', default: 200, min: 1, integer: true },
    format: { kind: 'select', label: 'output format', options: ['text', 'json'], default: 'text' }
  },
  examples: [
    {
      title: 'a short paragraph',
      input: 'The quick brown fox jumps over the lazy dog. '.repeat(40).trim(),
      output: '2 min read (360 words at 200 wpm)'
    }
  ],
  apply: (input: any, { wordsPerMinute, format }: any) => {
    const fmt = String(format || 'text')
    if (fmt !== 'text' && fmt !== 'json') {
      throw new Error(`unknown format "${fmt}" (expected text or json)`)
    }
    const wpm = Number(wordsPerMinute ?? 200)
    if (!Number.isFinite(wpm) || wpm <= 0) {
      throw new Error('words per minute must be a positive number')
    }

    const report = analyse(String(input ?? ''), wpm)
    if (fmt === 'json') return report
    return report.text
  }
}

export default util
