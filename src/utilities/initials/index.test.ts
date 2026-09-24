import { describe, it, expect } from 'vitest'
import util from './index'

describe('initials', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('initials')
    expect(util.name).toBe('initials / acronym')
    expect(util.category).toBe('String Ops')
    expect(util.accepts).toBe('string')
    expect(util.produces).toBe('string')
    expect(Object.keys(util.params)).toEqual(['separator', 'uppercase', 'skipSmallWords', 'maxLength'])
  })

  it('builds an acronym from a phrase', async () => {
    expect(await util.apply('Portable Network Graphics', {})).toBe('PNG')
    expect(await util.apply('cascading   style sheets', {})).toBe('CSS')
  })

  it('returns empty string for empty or word-free input', async () => {
    expect(await util.apply('', {})).toBe('')
    expect(await util.apply('!!! ??? ---', {})).toBe('')
  })

  it('joins the initials with a separator', async () => {
    expect(await util.apply('Portable Network Graphics', { separator: '.' })).toBe('P.N.G')
    expect(await util.apply('Portable Network Graphics', { separator: ' - ' })).toBe('P - N - G')
    expect(await util.apply('a b', { separator: '\\n' })).toBe('A\nB')
  })

  it('keeps the original case when uppercase is off', async () => {
    expect(await util.apply('portable network graphics', { uppercase: false })).toBe('png')
    expect(await util.apply('portable network graphics', { uppercase: true })).toBe('PNG')
  })

  it('skips small words but keeps the leading one', async () => {
    expect(await util.apply('The Lord of the Rings', { skipSmallWords: false })).toBe('TLOTR')
    expect(await util.apply('The Lord of the Rings', { skipSmallWords: true })).toBe('TLR')
  })

  it('caps the result at maxLength initials', async () => {
    expect(await util.apply('Portable Network Graphics', { maxLength: 2 })).toBe('PN')
    expect(await util.apply('Portable Network Graphics', { maxLength: 0 })).toBe('PNG')
    expect(await util.apply('one two three', { maxLength: 2, separator: '.' })).toBe('O.T')
  })

  it('splits on punctuation and hyphens', async () => {
    expect(await util.apply('Jean-Luc Picard', {})).toBe('JLP')
    expect(await util.apply('U.S.A.', {})).toBe('USA')
    expect(await util.apply("don't panic", {})).toBe('DP')
  })

  it('handles non-ASCII and astral letters', async () => {
    expect(await util.apply('Ñandú épico', {})).toBe('ÑÉ')
    expect(await util.apply('𝒜lpha beta', {})).toBe('𝒜B')
    expect(await util.apply('Привет мир', {})).toBe('ПМ')
  })

  it('yields one character per word even when uppercasing expands a letter', async () => {
    // 'ß'.toUpperCase() === 'SS' and 'ﬁ'.toUpperCase() === 'FI'.
    expect(await util.apply('ßeta gamma', {})).toBe('SG')
    expect(await util.apply('ﬁle system', {})).toBe('FS')
    expect(await util.apply('ßeta gamma', { uppercase: false })).toBe('ßg')
    // maxLength counts initials, so the cap must not be blown by the expansion.
    expect(await util.apply('ßa ßb ßc', { maxLength: 2 })).toBe('SS')
  })

  it('throws when maxLength is negative', () => {
    expect(() => util.apply('one two', { maxLength: -1 })).toThrow(/max length/)
    expect(() => util.apply('one two', { maxLength: 'abc' })).toThrow(/max length/)
  })
})
