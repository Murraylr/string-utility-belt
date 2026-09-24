import { describe, it, expect } from 'vitest'
import util from './index'

describe('regex_extract', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('regex_extract')
    expect(util.category).toBe('String Ops')
    expect(util.params.flags.default).toBe('g')
    expect(util.params.pattern.kind).toBe('regex')
    expect((util.params.pattern as any).flagsParam).toBe('flags')
  })

  it('extracts all numbers', () => {
    expect(util.apply('abc 123 def 456', { pattern: '\\d+', flags: 'g' }))
      .toBe('123\n456')
  })

  it('extracts all words', () => {
    expect(util.apply('hello world', { pattern: '\\w+', flags: 'g' }))
      .toBe('hello\nworld')
  })

  it('returns empty string when no matches', () => {
    expect(util.apply('hello', { pattern: '\\d+', flags: 'g' })).toBe('')
  })

  it('returns input when pattern is empty', () => {
    expect(util.apply('hello', { pattern: '', flags: 'g' })).toBe('hello')
  })

  it('handles empty input', () => {
    expect(util.apply('', { pattern: '\\w+', flags: 'g' })).toBe('')
  })

  it('extracts with case-insensitive flag', () => {
    expect(util.apply('Hello WORLD hello', { pattern: 'hello', flags: 'gi' }))
      .toBe('Hello\nhello')
  })

  it('extracts single match', () => {
    expect(util.apply('abc 123 def', { pattern: '\\d+', flags: '' }))
      .toBe('123')
  })

  it('extracts all matches even when user flags omit g', () => {
    expect(util.apply('abc 123 def 456', { pattern: '\\d+', flags: 'i' }))
      .toBe('123\n456')
  })

  it('does not leak capture groups into output for non-g flags', () => {
    expect(util.apply('ab 42 cd 7', { pattern: '(\\d)(\\d)', flags: 'i' }))
      .toBe('42')
  })
})
