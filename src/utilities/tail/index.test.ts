import { describe, it, expect } from 'vitest'
import util from './index'

const FIVE = 'one\ntwo\nthree\nfour\nfive\n'

describe('tail', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('tail')
    expect(util.name).toBe('tail')
    expect(util.category).toBe('Lines')
    expect(util.accepts).toBe('string')
    expect(util.produces).toBe('string')
    expect(Object.keys(util.params).sort()).toEqual(['count', 'unit'])
  })

  it('keeps the last N lines', async () => {
    expect(await util.apply(FIVE, { count: 2 })).toBe('four\nfive\n')
    expect(await util.apply(FIVE, { count: 2, unit: 'lines' })).toBe('four\nfive\n')
  })

  it('returns empty string for empty input or a zero count', async () => {
    expect(await util.apply('', {})).toBe('')
    expect(await util.apply('', { count: 3, unit: 'words' })).toBe('')
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

  it('treats a negative count as "all but the first N"', async () => {
    expect(await util.apply(FIVE, { count: -2 })).toBe('three\nfour\nfive\n')
    expect(await util.apply(FIVE, { count: -99 })).toBe('')
    expect(await util.apply('hello', { count: -2, unit: 'characters' })).toBe('llo')
    expect(await util.apply('the quick  brown fox', { count: -1, unit: 'words' })).toBe(
      'quick  brown fox'
    )
  })

  it('keeps the last N characters by code point', async () => {
    expect(await util.apply('hello world', { count: 5, unit: 'characters' })).toBe('world')
    // astral characters must not be split into surrogate halves
    expect(await util.apply('abc🎉🎊🎈', { count: 2, unit: 'characters' })).toBe('🎊🎈')
    expect(await util.apply('日本語テキスト', { count: 3, unit: 'characters' })).toBe('キスト')
  })

  it('keeps the last N words and preserves the original spacing', async () => {
    expect(await util.apply('the quick  brown fox', { count: 2, unit: 'words' })).toBe('brown fox')
    expect(await util.apply('trailing space here   ', { count: 1, unit: 'words' })).toBe('here   ')
    expect(await util.apply('done 🎉 café naïve', { count: 3, unit: 'words' })).toBe('🎉 café naïve')
  })

  it('preserves CRLF endings and the absence of a trailing newline', async () => {
    expect(await util.apply('a\r\nb\r\nc\r\n', { count: 2 })).toBe('b\r\nc\r\n')
    expect(await util.apply('a\nb\nc', { count: 2 })).toBe('b\nc')
  })

  it('leaves each line ending alone in a file with mixed endings', async () => {
    const mixed = 'a\r\nb\nc\nd\n'
    // the single CRLF on line 1 must not convert the LF-terminated lines
    expect(await util.apply(mixed, { count: 2 })).toBe('c\nd\n')
    expect(await util.apply(mixed, { count: 4 })).toBe(mixed)
    expect(await util.apply(mixed, { count: -3 })).toBe('d\n')
  })

  it('drops a header row with a negative count of one', async () => {
    expect(await util.apply(FIVE, { count: -1 })).toBe('two\nthree\nfour\nfive\n')
  })

  it('throws on a non-numeric count or an unknown unit', () => {
    expect(() => util.apply('abc', { count: 'lots' })).toThrow(/count must be a finite number/)
    expect(() => util.apply('abc', { count: 1, unit: 'sentences' })).toThrow(/unknown unit/)
  })
})
