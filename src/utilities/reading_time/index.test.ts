import { describe, it, expect } from 'vitest'
import util, { countWords } from './index'

type Report = Record<string, any>

const repeat = (word: string, n: number) => Array.from({ length: n }, () => word).join(' ')

describe('reading_time', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('reading_time')
    expect(util.name).toBe('reading time')
    expect(util.category).toBe('Analysis')
    expect(util.accepts).toBe('string')
    expect(util.produces).toEqual(['string', 'json'])
    expect(util.params.wordsPerMinute).toEqual({
      kind: 'number',
      label: 'words per minute',
      default: 200,
      min: 1,
      integer: true
    })
    expect(util.params.format).toEqual({
      kind: 'select',
      label: 'output format',
      options: ['text', 'json'],
      default: 'text'
    })
  })

  it('estimates a short read as less than a minute', async () => {
    expect(await util.apply('hello world', {})).toBe('less than a minute read (2 words at 200 wpm)')
    expect(await util.apply('hello', {})).toBe('less than a minute read (1 word at 200 wpm)')
    // 2 words / 200 wpm * 60 = 0.6s, rounded to 1
    const r = (await util.apply('hello world', { format: 'json' })) as Report
    expect(r.totalSeconds).toBe(1)
    expect(r.minutes).toBe(0)
    expect(r.seconds).toBe(1)
    expect(r.roundedMinutes).toBe(1)
    expect(r.duration).toBe('1 second')
  })

  it('estimates a long read in minutes at the default rate', async () => {
    const text = repeat('word', 500)
    expect(await util.apply(text, {})).toBe('3 min read (500 words at 200 wpm)')
  })

  it('honours a custom wordsPerMinute', async () => {
    const text = repeat('word', 500)
    expect(await util.apply(text, { wordsPerMinute: 250 })).toBe('2 min read (500 words at 250 wpm)')
    expect(await util.apply(text, { wordsPerMinute: 100 })).toBe('5 min read (500 words at 100 wpm)')
    const r = (await util.apply(text, { wordsPerMinute: 250, format: 'json' })) as Report
    expect(r.wordsPerMinute).toBe(250)
    expect(r.totalSeconds).toBe(120) // 500 / 250 * 60
    expect(r.duration).toBe('2 minutes')
  })

  it('returns structured data for format json', async () => {
    const r = (await util.apply(repeat('word', 500), { format: 'json' })) as Report
    expect(r.words).toBe(500)
    expect(r.wordsPerMinute).toBe(200)
    expect(r.totalSeconds).toBe(150) // 500 / 200 * 60
    expect(r.minutes).toBe(2)
    expect(r.seconds).toBe(30)
    expect(r.roundedMinutes).toBe(3)
    expect(r.duration).toBe('2 minutes 30 seconds')
    expect(r.text).toBe('3 min read (500 words at 200 wpm)')
  })

  it('switches from "less than a minute" to "N min read" at exactly 60 seconds', async () => {
    const under = (await util.apply(repeat('w', 199), { format: 'json' })) as Report
    expect(under.totalSeconds).toBe(60) // 199/200*60 = 59.7, rounds to 60
    expect(under.text).toBe('1 min read (199 words at 200 wpm)')

    const exact = (await util.apply(repeat('w', 200), { format: 'json' })) as Report
    expect(exact.totalSeconds).toBe(60)
    expect(exact.minutes).toBe(1)
    expect(exact.seconds).toBe(0)
    expect(exact.roundedMinutes).toBe(1)
    expect(exact.duration).toBe('1 minute')
    expect(exact.text).toBe('1 min read (200 words at 200 wpm)')

    const below = (await util.apply(repeat('w', 100), { format: 'json' })) as Report
    expect(below.totalSeconds).toBe(30)
    expect(below.text).toBe('less than a minute read (100 words at 200 wpm)')
  })

  it('degrades gracefully at an absurd rate', async () => {
    const r = (await util.apply('hi', { format: 'json', wordsPerMinute: 100000 })) as Report
    expect(r.totalSeconds).toBe(0)
    expect(r.duration).toBe('less than a second')
    expect(r.roundedMinutes).toBe(1)
  })

  it('handles empty input without throwing', async () => {
    expect(await util.apply('', {})).toBe('')
    expect(await util.apply('   \n\t ', { format: 'text' })).toBe('')
    const r = (await util.apply('', { format: 'json' })) as Report
    expect(r.words).toBe(0)
    expect(r.totalSeconds).toBe(0)
    expect(r.roundedMinutes).toBe(0)
    expect(r.duration).toBe('')
    expect(r.text).toBe('')
  })

  it('counts unicode words and CJK characters individually', () => {
    expect(countWords('café naïve')).toBe(2)
    expect(countWords('你好世界')).toBe(4)
    expect(countWords('日本語 のテキスト')).toBe(8) // 3 han + 1 hiragana + 4 katakana
    expect(countWords('안녕하세요')).toBe(5)
    expect(countWords('a 🙂 b')).toBe(2) // the emoji is not a word
    expect(countWords("don't count 3.5 twice")).toBe(4)
    expect(countWords('state-of-the-art')).toBe(1)
    // astral-plane Han (CJK Ext. B) must count as 2 words, not 4 surrogate halves
    expect(countWords('\u{20000}\u{20001}')).toBe(2)
    expect('\u{20000}\u{20001}'.length).toBe(4)
  })

  it('mixes CJK and latin word counts', async () => {
    const r = (await util.apply('hello 世界', { format: 'json' })) as Report
    expect(r.words).toBe(3)
    expect(r.text).toBe('less than a minute read (3 words at 200 wpm)')
  })

  it('throws on a non-positive or non-numeric rate', () => {
    expect(() => util.apply('hello world', { wordsPerMinute: 0 })).toThrow(/positive number/)
    expect(() => util.apply('hello world', { wordsPerMinute: -5 })).toThrow(/positive number/)
    expect(() => util.apply('hello world', { wordsPerMinute: 'fast' })).toThrow(/positive number/)
    expect(() => util.apply('hello world', { wordsPerMinute: Infinity })).toThrow(/positive number/)
  })

  it('falls back to the declared default when the rate is absent', async () => {
    const r = (await util.apply('hello world', { format: 'json', wordsPerMinute: undefined })) as Report
    expect(r.wordsPerMinute).toBe(200)
  })

  it('throws on an unknown format', () => {
    expect(() => util.apply('hello', { format: 'xml' })).toThrow(/unknown format "xml"/)
  })
})
