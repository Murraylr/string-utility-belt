import { describe, it, expect } from 'vitest'
import util from './index'
import unwrap from '../unwrap/index'

/** Spelled by code point on purpose: a literal NBSP would be invisible in the source. */
const NBSP = String.fromCharCode(0x00a0)

describe('word_wrap', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('word_wrap')
    expect(util.name).toBe('word wrap')
    expect(util.category).toBe('Formatting')
    expect(util.accepts).toBe('string')
    expect(util.produces).toBe('string')
    expect(Object.keys(util.params).sort()).toEqual([
      'breakLongWords',
      'indent',
      'preserveParagraphs',
      'trailingSpaces',
      'width'
    ])
  })

  it('wraps on word boundaries at the given width', async () => {
    expect(await util.apply('The quick brown fox jumps over the lazy dog', { width: 10 }))
      .toBe('The quick\nbrown fox\njumps over\nthe lazy\ndog')
    // a line that lands exactly on the width stays whole; one character more breaks
    expect(await util.apply('aaaaa bb', { width: 8 })).toBe('aaaaa bb')
    expect(await util.apply('aaaaa bbb', { width: 8 })).toBe('aaaaa\nbbb')
  })

  it('breaks long words only when asked', async () => {
    expect(await util.apply('abcdefghij', { width: 4, breakLongWords: false })).toBe('abcdefghij')
    expect(await util.apply('abcdefghij', { width: 4, breakLongWords: true })).toBe('abcd\nefgh\nij')
    expect(await util.apply('hi abcdefgh', { width: 5, breakLongWords: true })).toBe('hi ab\ncdefg\nh')
    // an unbreakable word gets its own line rather than dragging its neighbours along
    expect(await util.apply('hi abcdefghij ok', { width: 5, breakLongWords: false }))
      .toBe('hi\nabcdefghij\nok')
  })

  it('prefixes an indent that counts against the width', async () => {
    expect(await util.apply('one two three', { width: 10, indent: '> ' })).toBe('> one two\n> three')
    expect(await util.apply('abcdefghij', { width: 6, indent: '>> ', breakLongWords: true }))
      .toBe('>> abc\n>> def\n>> ghi\n>> j')
  })

  it('reflows or preserves existing line structure', async () => {
    const src = 'line one\nline two\n\nsecond para'
    expect(await util.apply(src, { width: 80, preserveParagraphs: true }))
      .toBe('line one line two\n\nsecond para')
    expect(await util.apply(src, { width: 80, preserveParagraphs: false }))
      .toBe('line one\nline two\n\nsecond para')
  })

  it('keeps the soft-break trailing space only where a word break actually falls', async () => {
    expect(await util.apply('aaa bbb ccc', { width: 4, trailingSpaces: true })).toBe('aaa \nbbb \nccc')
    expect(await util.apply('aaa bbb ccc', { width: 4, trailingSpaces: false })).toBe('aaa\nbbb\nccc')
    // a break forced through the middle of a word is NOT a word break: a trailing
    // space there gets glued into the word by anything that reflows the text
    expect(await util.apply('abcdefghij', { width: 4, breakLongWords: true, trailingSpaces: true }))
      .toBe('abcd\nefgh\nij')
    expect(await util.apply('hi abcdefgh', { width: 5, breakLongWords: true, trailingSpaces: true }))
      .toBe('hi ab\ncdefg\nh')
    // ...but the break before an over-long word still is one
    expect(await util.apply('hello abcdefghij', { width: 6, breakLongWords: true, trailingSpaces: true }))
      .toBe('hello \nabcdef\nghij')
  })

  it('never treats a non-breaking space as a break opportunity', async () => {
    // \s matches U+00A0 in JavaScript, so a naive split would both break here and
    // silently replace the character with a plain space
    expect(await util.apply('x' + NBSP + 'y', { width: 2 })).toBe('x' + NBSP + 'y')
    expect(await util.apply('a b' + NBSP + 'c d', { width: 3 })).toBe('a\nb' + NBSP + 'c\nd')
  })

  it('measures and breaks by code point so emoji survive', async () => {
    expect(await util.apply('😀😀 😀😀😀', { width: 3 })).toBe('😀😀\n😀😀😀')
    expect(await util.apply('😀😀😀😀', { width: 2, breakLongWords: true })).toBe('😀😀\n😀😀')
    const broken = String(await util.apply('😀😀😀😀', { width: 2, breakLongWords: true }))
    expect(Array.from(broken)).toHaveLength(5) // 4 emoji + newline, no split surrogates
  })

  it('returns empty string for empty input and keeps blank-line structure', async () => {
    expect(await util.apply('', {})).toBe('')
    expect(await util.apply('a\n\n\nb', { width: 20 })).toBe('a\n\n\nb')
  })

  it('round-trips through unwrap whenever no word had to be broken', async () => {
    const src = 'The quick brown fox jumps over the lazy dog near the wide river bank'
    for (const width of [8, 12, 20, 40]) {
      for (const trailingSpaces of [true, false]) {
        const wrapped = String(await util.apply(src, { width, trailingSpaces }))
        expect(String(await unwrap.apply(wrapped, {}))).toBe(src)
      }
    }
  })

  it('throws on invalid params', () => {
    expect(() => util.apply('x', { width: 0 })).toThrow(/width/)
    expect(() => util.apply('x', { width: 3.5 })).toThrow(/whole number/)
    expect(() => util.apply('x', { width: 2, indent: '    ' })).toThrow(/no room/)
    expect(() => util.apply('x', { indent: 'a\nb' })).toThrow(/line break/)
  })
})
