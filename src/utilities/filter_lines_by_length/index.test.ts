import { describe, it, expect } from 'vitest'
import util from './index'

describe('filter_lines_by_length', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('filter_lines_by_length')
    expect(util.name).toBe('filter lines by length')
    expect(util.category).toBe('Lines')
    expect(util.accepts).toBe('string')
    expect(util.produces).toBe('string')
  })

  it('keeps lines at or above the minimum length', async () => {
    expect(await util.apply('a\nbb\nccc', { min: 2 })).toBe('bb\nccc')
  })

  it('keeps lines at or below the maximum length, and treats 0 as no maximum', async () => {
    expect(await util.apply('a\nbb\nccc', { max: 2 })).toBe('a\nbb')
    expect(await util.apply('a\nbb\nccc', { max: 0 })).toBe('a\nbb\nccc')
    expect(await util.apply('a\nbb\nccc', { min: 2, max: 2 })).toBe('bb')
  })

  it('passes everything through with the default params', async () => {
    const input = 'first line\n\nthird line'
    expect(await util.apply(input, {})).toBe(input)
  })

  it('measures words when the unit is words', async () => {
    const input = 'one two three\nfour\nfive six'
    expect(await util.apply(input, { min: 2, unit: 'words' })).toBe('one two three\nfive six')
    expect(await util.apply(input, { max: 1, unit: 'words' })).toBe('four')
    // characters unit sees the same lines very differently
    expect(await util.apply(input, { max: 1, unit: 'characters' })).toBe('')
  })

  it('inverts the match when asked', async () => {
    expect(await util.apply('a\nbb\nccc', { min: 2, invert: true })).toBe('a')
    expect(await util.apply('a\nbb\nccc', { min: 2, invert: false })).toBe('bb\nccc')
  })

  it('handles empty input and drops a lone leftover newline', async () => {
    expect(await util.apply('', {})).toBe('')
    expect(await util.apply('', { min: 3 })).toBe('')
    expect(await util.apply('a\n', { min: 3 })).toBe('')
  })

  it('counts astral characters once and preserves the trailing newline', async () => {
    // '🍎🍎' is 2 code points but 4 UTF-16 units — a max of 2 must keep it
    expect(await util.apply('🍎🍎\nabc', { max: 2 })).toBe('🍎🍎')
    expect(await util.apply('café\nnö', { min: 3 })).toBe('café')
    expect(await util.apply('a\nbb\n', { min: 2 })).toBe('bb\n')
    expect(await util.apply('a\r\nbb\r\n', { min: 2 })).toBe('bb\r\n')
  })

  it('compares against a fractional bound exactly, without rounding it away', async () => {
    // a min of 2.5 means "longer than 2.5": the 2-character line must NOT survive
    expect(await util.apply('a\nbb\nccc', { min: 2.5 })).toBe('ccc')
    // a max of 2.5 means "no longer than 2.5": the 2-character line must survive
    expect(await util.apply('a\nbb\nccc', { max: 2.5 })).toBe('a\nbb')
  })

  it('rejects nonsensical bounds and units', () => {
    expect(() => util.apply('a', { min: -1 })).toThrow(/zero or greater/)
    expect(() => util.apply('a', { max: -5 })).toThrow(/zero or greater/)
    expect(() => util.apply('a', { min: 5, max: 2 })).toThrow(/greater than max/)
    expect(() => util.apply('a', { min: 'abc' })).toThrow(/must be a number/)
    expect(() => util.apply('a', { unit: 'syllables' })).toThrow(/unknown unit/)
  })
})
