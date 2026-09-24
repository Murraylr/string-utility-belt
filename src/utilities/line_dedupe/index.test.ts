import { describe, it, expect } from 'vitest'
import util from './index'

describe('line_dedupe', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('line_dedupe')
    expect(util.category).toBe('Formatting')
    expect(util.params.caseSensitive.default).toBe(true)
  })

  it('removes duplicate lines (case-sensitive)', () => {
    expect(util.apply('a\nb\na\nc\nb', { caseSensitive: true }))
      .toBe('a\nb\nc')
  })

  it('removes duplicates case-insensitively', () => {
    expect(util.apply('Hello\nhello\nHELLO\nworld', { caseSensitive: false }))
      .toBe('Hello\nworld')
  })

  it('preserves order of first occurrence', () => {
    expect(util.apply('c\na\nb\na\nc', { caseSensitive: true }))
      .toBe('c\na\nb')
  })

  it('handles no duplicates', () => {
    expect(util.apply('a\nb\nc', { caseSensitive: true }))
      .toBe('a\nb\nc')
  })

  it('handles all duplicates', () => {
    expect(util.apply('a\na\na', { caseSensitive: true })).toBe('a')
  })

  it('handles empty string', () => {
    expect(util.apply('', { caseSensitive: true })).toBe('')
  })

  it('handles single line', () => {
    expect(util.apply('hello', { caseSensitive: true })).toBe('hello')
  })
})
