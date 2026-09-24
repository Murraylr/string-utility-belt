import { describe, it, expect } from 'vitest'
import util from './index'

describe('slice', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('slice')
    expect(util.name).toBe('slice')
    expect(util.category).toBe('String Ops')
    expect(util.accepts).toBe('string')
    expect(util.produces).toBe('string')
    expect(util.params.start.default).toBe(0)
    expect(util.params.end.default).toBe(0)
  })

  it('slices with start and end', () => {
    expect(util.apply('abcdef', { start: 1, end: 4 })).toBe('bcd')
  })

  it('slices from start to end of string when end is 0', () => {
    expect(util.apply('abcdef', { start: 2, end: 0 })).toBe('cdef')
  })

  it('slices from beginning when start is 0', () => {
    expect(util.apply('abcdef', { start: 0, end: 3 })).toBe('abc')
  })

  it('handles negative start index', () => {
    expect(util.apply('abcdef', { start: -3, end: 0 })).toBe('def')
  })

  it('handles negative end index', () => {
    expect(util.apply('abcdef', { start: 0, end: -1 })).toBe('abcde')
  })

  it('returns empty when start >= end', () => {
    expect(util.apply('abcdef', { start: 4, end: 2 })).toBe('')
  })

  it('handles empty string', () => {
    expect(util.apply('', { start: 0, end: 0 })).toBe('')
  })

  it('returns full string when both are 0', () => {
    expect(util.apply('hello', { start: 0, end: 0 })).toBe('hello')
  })

  it('handles start beyond string length', () => {
    expect(util.apply('abc', { start: 10, end: 0 })).toBe('')
  })
})
