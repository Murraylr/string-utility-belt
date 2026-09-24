import { describe, it, expect } from 'vitest'
import util from './index'

describe('replace', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('replace')
    expect(util.name).toBe('replace')
    expect(util.category).toBe('String Ops')
    expect(util.accepts).toBe('string')
    expect(util.produces).toBe('string')
  })

  it('replaces with regex globally', () => {
    expect(util.apply('banana', { pattern: 'ba.', replacement: 'X', regex: true, flags: 'g' }))
      .toBe('Xana')
  })

  it('replaces with plain string (all occurrences)', () => {
    expect(util.apply('aabaa', { pattern: 'aa', replacement: 'X', regex: false, flags: '' }))
      .toBe('XbX')
  })

  it('returns input when pattern is empty', () => {
    expect(util.apply('hello', { pattern: '', replacement: 'X', regex: true, flags: 'g' }))
      .toBe('hello')
  })

  it('replaces with case-insensitive flag', () => {
    expect(util.apply('Hello hello', { pattern: 'hello', replacement: 'hi', regex: true, flags: 'gi' }))
      .toBe('hi hi')
  })

  it('handles replacement with empty string (deletion)', () => {
    expect(util.apply('abc123def', { pattern: '\\d+', replacement: '', regex: true, flags: 'g' }))
      .toBe('abcdef')
  })

  it('replaces only the first match with explicitly empty flags', () => {
    expect(util.apply('aaa', { pattern: 'a', replacement: 'b', regex: true, flags: '' }))
      .toBe('baa')
  })

  it('defaults to global replace when flags are absent', () => {
    expect(util.apply('aaa', { pattern: 'a', replacement: 'b', regex: true }))
      .toBe('bbb')
  })

  it('handles empty input', () => {
    expect(util.apply('', { pattern: 'a', replacement: 'b', regex: true, flags: 'g' }))
      .toBe('')
  })

  it('handles special regex characters in plain mode', () => {
    expect(util.apply('a.b.c', { pattern: '.', replacement: '-', regex: false, flags: '' }))
      .toBe('a-b-c')
  })

  it('defaults replacement to empty string when undefined', () => {
    expect(util.apply('abc', { pattern: 'b', replacement: undefined, regex: true, flags: 'g' }))
      .toBe('ac')
  })
})
