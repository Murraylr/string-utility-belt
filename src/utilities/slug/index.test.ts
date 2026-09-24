import { describe, it, expect } from 'vitest'
import util from './index'

describe('slug', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('slug')
    expect(util.name).toBe('slug')
    expect(util.category).toBe('Formatting')
    expect(util.accepts).toBe('string')
    expect(util.produces).toBe('string')
  })

  it('converts text with accents to slug', () => {
    expect(util.apply('Hello, Café World!', {})).toBe('hello-cafe-world')
  })

  it('converts spaces to hyphens', () => {
    expect(util.apply('hello world', {})).toBe('hello-world')
  })

  it('strips leading and trailing hyphens', () => {
    expect(util.apply('  hello  ', {})).toBe('hello')
    expect(util.apply('---hello---', {})).toBe('hello')
  })

  it('collapses multiple separators', () => {
    expect(util.apply('a   b   c', {})).toBe('a-b-c')
    expect(util.apply('a!!!b!!!c', {})).toBe('a-b-c')
  })

  it('lowercases everything', () => {
    expect(util.apply('Hello World', {})).toBe('hello-world')
  })

  it('handles empty string', () => {
    expect(util.apply('', {})).toBe('')
  })

  it('handles only special characters', () => {
    expect(util.apply('!@#$%', {})).toBe('')
  })

  it('handles numbers', () => {
    expect(util.apply('abc 123 def', {})).toBe('abc-123-def')
  })

  it('handles already-slugified input', () => {
    expect(util.apply('hello-world', {})).toBe('hello-world')
  })
})
