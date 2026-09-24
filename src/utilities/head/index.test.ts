import { describe, it, expect } from 'vitest'
import util from './index'

const FIVE = 'one\ntwo\nthree\nfour\nfive\n'

describe('head', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('head')
    expect(util.name).toBe('head')
    expect(util.category).toBe('Lines')
    expect(util.accepts).toBe('string')
    expect(util.produces).toBe('string')
    expect(Object.keys(util.params).sort()).toEqual(['count', 'unit'])
  })

  it('keeps the first N lines', async () => {
    expect(await util.apply(FIVE, { count: 2 })).toBe('one\ntwo\n')
    expect(await util.apply(FIVE, { count: 2, unit: 'lines' })).toBe('one\ntwo\n')
  })

  it('returns empty string for empty input or a zero count', async () => {
    expect(await util.apply('', {})).toBe('')
    expect(await util.apply('', { count: 3, unit: 'characters' })).toBe('')
    expect(await util.apply(FIVE, { count: 0 })).toBe('')
  })

  it('returns everything when the count exceeds the input', async () => {
    expect(await util.apply(FIVE, { count: 99 })).toBe(FIVE)
    expect(await util.apply('hi', { count: 99, unit: 'characters' })).toBe('hi')
    expect(await util.apply('a b', { count: 99, unit: 'words' })).toBe('a b')
    // surrounding whitespace must survive too — every unit has to be a true no-op here
    const padded = '  a  b  '
    expect(await util.apply(padded, { count: 99, unit: 'words' })).toBe(padded)
    expect(await util.apply(padded, { count: 99, unit: 'characters' })).toBe(padded)
    expect(await util.apply(padded, { count: 99, unit: 'lines' })).toBe(padded)
  })

  it('treats a negative count as "all but the last N"', async () => {
    expect(await util.apply(FIVE, { count: -2 })).toBe('one\ntwo\nthree\n')
    expect(await util.apply(FIVE, { count: -99 })).toBe('')
    expect(await util.apply('hello', { count: -2, unit: 'characters' })).toBe('hel')
    expect(await util.apply('the quick brown fox', { count: -1, unit: 'words' })).toBe(
      'the quick brown'
    )
  })

  it('keeps the first N characters by code point', async () => {
    expect(await util.apply('hello world', { count: 5, unit: 'characters' })).toBe('hello')
    // astral characters must not be split into surrogate halves
    expect(await util.apply('🎉🎊🎈abc', { count: 2, unit: 'characters' })).toBe('🎉🎊')
    expect(await util.apply('日本語テキスト', { count: 3, unit: 'characters' })).toBe('日本語')
  })

  it('keeps the first N words and preserves the original spacing', async () => {
    expect(await util.apply('the quick  brown fox', { count: 3, unit: 'words' })).toBe(
      'the quick  brown'
    )
    expect(await util.apply('  leading space here', { count: 2, unit: 'words' })).toBe(
      '  leading space'
    )
    expect(await util.apply('naïve café 🎉 done', { count: 3, unit: 'words' })).toBe(
      'naïve café 🎉'
    )
  })

  it('preserves CRLF endings and the absence of a trailing newline', async () => {
    expect(await util.apply('a\r\nb\r\nc\r\n', { count: 2 })).toBe('a\r\nb\r\n')
    expect(await util.apply('a\nb\nc', { count: 2 })).toBe('a\nb')
  })

  it('leaves each line ending alone in a file with mixed endings', async () => {
    const mixed = 'a\r\nb\nc\nd\n'
    // the single CRLF on line 1 must not convert the LF-terminated lines
    expect(await util.apply(mixed, { count: 3 })).toBe('a\r\nb\nc\n')
    expect(await util.apply(mixed, { count: 1 })).toBe('a\r\n')
    expect(await util.apply(mixed, { count: 99 })).toBe(mixed)
  })

  it('throws on a non-numeric count or an unknown unit', () => {
    expect(() => util.apply('abc', { count: 'lots' })).toThrow(/count must be a finite number/)
    expect(() => util.apply('abc', { count: 1, unit: 'paragraphs' })).toThrow(/unknown unit/)
  })
})
