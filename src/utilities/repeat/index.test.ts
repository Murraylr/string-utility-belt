import { describe, it, expect } from 'vitest'
import util from './index'

describe('repeat', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('repeat')
    expect(util.category).toBe('String Ops')
    expect(util.params.count.default).toBe(2)
    expect(util.params.separator.default).toBe('')
  })

  it('repeats string N times', () => {
    expect(util.apply('ab', { count: 3, separator: '' })).toBe('ababab')
  })

  it('repeats with separator', () => {
    expect(util.apply('hi', { count: 3, separator: ', ' })).toBe('hi, hi, hi')
  })

  it('defaults to 2 repetitions', () => {
    expect(util.apply('x', { count: 2, separator: '' })).toBe('xx')
  })

  it('handles count of 0', () => {
    expect(util.apply('hello', { count: 0, separator: '' })).toBe('')
  })

  it('handles count of 1', () => {
    expect(util.apply('hello', { count: 1, separator: '' })).toBe('hello')
  })

  it('handles empty string', () => {
    expect(util.apply('', { count: 5, separator: '' })).toBe('')
  })

  it('handles negative count as 0', () => {
    expect(util.apply('a', { count: -3, separator: '' })).toBe('')
  })
})
