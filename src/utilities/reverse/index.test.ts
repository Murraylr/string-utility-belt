import { describe, it, expect } from 'vitest'
import util from './index'

describe('reverse', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('reverse')
    expect(util.category).toBe('String Ops')
    expect(util.accepts).toBe('string')
    expect(util.produces).toBe('string')
  })

  it('reverses a simple string', () => {
    expect(util.apply('hello', {})).toBe('olleh')
  })

  it('reverses a string with spaces', () => {
    expect(util.apply('hello world', {})).toBe('dlrow olleh')
  })

  it('handles empty string', () => {
    expect(util.apply('', {})).toBe('')
  })

  it('handles single character', () => {
    expect(util.apply('a', {})).toBe('a')
  })

  it('handles palindrome', () => {
    expect(util.apply('racecar', {})).toBe('racecar')
  })

  it('handles unicode characters', () => {
    expect(util.apply('café', {})).toBe('éfac')
  })

  it('is its own inverse', () => {
    expect(util.apply(util.apply('abc', {}) as string, {})).toBe('abc')
  })
})
