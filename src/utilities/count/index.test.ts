import { describe, it, expect } from 'vitest'
import util from './index'

describe('count', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('count')
    expect(util.category).toBe('Analysis')
    expect(util.accepts).toBe('string')
    expect(util.produces).toBe('string')
  })

  it('counts characters, words, and lines', () => {
    const out = util.apply('hello world', {})
    expect(out).toBe('characters: 11\nwords: 2\nlines: 1')
  })

  it('counts multiline text', () => {
    const out = util.apply('hello\nworld\nfoo', {})
    expect(out).toBe('characters: 15\nwords: 3\nlines: 3')
  })

  it('handles empty string', () => {
    const out = util.apply('', {})
    expect(out).toBe('characters: 0\nwords: 0\nlines: 0')
  })

  it('handles single word', () => {
    expect(util.apply('hello', {})).toBe('characters: 5\nwords: 1\nlines: 1')
  })

  it('handles multiple spaces between words', () => {
    expect(util.apply('a   b   c', {})).toBe('characters: 9\nwords: 3\nlines: 1')
  })

  it('handles whitespace-only string', () => {
    expect(util.apply('   ', {})).toBe('characters: 3\nwords: 0\nlines: 1')
  })
})
