import { describe, it, expect } from 'vitest'
import util from './index'

describe('json_escape', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('json_escape')
    expect(util.category).toBe('Encoding')
  })

  it('escapes double quotes', () => {
    expect(util.apply('say "hello"', {})).toBe('say \\"hello\\"')
  })

  it('escapes backslashes', () => {
    expect(util.apply('a\\b', {})).toBe('a\\\\b')
  })

  it('escapes newlines and tabs', () => {
    expect(util.apply('a\nb\tc', {})).toBe('a\\nb\\tc')
  })

  it('handles empty string', () => {
    expect(util.apply('', {})).toBe('')
  })

  it('handles string with no special chars', () => {
    expect(util.apply('hello', {})).toBe('hello')
  })

  it('escapes control characters', () => {
    const out = util.apply('\r\n', {})
    expect(out).toBe('\\r\\n')
  })
})
