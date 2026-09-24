import { describe, it, expect } from 'vitest'
import util from './index'

describe('trim', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('trim')
    expect(util.name).toBe('trim')
    expect(util.category).toBe('String Ops')
    expect(util.accepts).toBe('string')
    expect(util.produces).toBe('string')
  })

  it('trims leading and trailing spaces', () => {
    expect(util.apply('  hello  ', {})).toBe('hello')
  })

  it('trims tabs and newlines', () => {
    expect(util.apply('\t\nhello\n\t', {})).toBe('hello')
  })

  it('preserves internal whitespace', () => {
    expect(util.apply('  hello world  ', {})).toBe('hello world')
  })

  it('handles empty string', () => {
    expect(util.apply('', {})).toBe('')
  })

  it('handles whitespace-only string', () => {
    expect(util.apply('   \t\n  ', {})).toBe('')
  })

  it('handles already-trimmed string', () => {
    expect(util.apply('hello', {})).toBe('hello')
  })

  it('handles carriage returns', () => {
    expect(util.apply('\r\nhello\r\n', {})).toBe('hello')
  })
})
