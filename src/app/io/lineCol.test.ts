import { describe, expect, it } from 'vitest'
import { computeLineCol, lineStartOffset, totalLines } from './lineCol'

describe('computeLineCol', () => {
  it('is line 1 col 1 at the start of the text', () => {
    expect(computeLineCol('hello', 0)).toEqual({ line: 1, col: 1 })
  })
  it('counts columns after typing on the first line', () => {
    expect(computeLineCol('hello', 3)).toEqual({ line: 1, col: 4 })
  })
  it('advances the line after each newline', () => {
    const text = 'a\nbb\nccc'
    expect(computeLineCol(text, text.indexOf('ccc') + 2)).toEqual({ line: 3, col: 3 })
  })
  it('counts a surrogate-pair emoji as a single column', () => {
    const text = '😀x' // U+1F600 is a surrogate pair (2 UTF-16 units)
    expect(computeLineCol(text, text.length)).toEqual({ line: 1, col: 3 })
  })
})

describe('lineStartOffset', () => {
  it('finds the offset of each line', () => {
    const text = 'a\nbb\nccc'
    expect(lineStartOffset(text, 1)).toBe(0)
    expect(lineStartOffset(text, 2)).toBe(2)
    expect(lineStartOffset(text, 3)).toBe(5)
  })
  it('clamps below the first line and above the last', () => {
    const text = 'a\nbb'
    expect(lineStartOffset(text, 0)).toBe(0)
    expect(lineStartOffset(text, 99)).toBe(lineStartOffset(text, 2))
  })
})

describe('totalLines', () => {
  it('counts newlines plus one', () => {
    expect(totalLines('')).toBe(1)
    expect(totalLines('a')).toBe(1)
    expect(totalLines('a\nb\nc')).toBe(3)
  })
})
