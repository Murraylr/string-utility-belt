import { describe, it, expect } from 'vitest'
import util from './index'

describe('json_unescape', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('json_unescape')
    expect(util.category).toBe('Decoding')
  })

  it('unescapes quotes', () => {
    expect(util.apply('say \\"hello\\"', {})).toBe('say "hello"')
  })

  it('unescapes backslashes', () => {
    expect(util.apply('a\\\\b', {})).toBe('a\\b')
  })

  it('unescapes newlines and tabs', () => {
    expect(util.apply('a\\nb\\tc', {})).toBe('a\nb\tc')
  })

  it('handles empty string', () => {
    expect(util.apply('', {})).toBe('')
  })

  it('handles string with no escapes', () => {
    expect(util.apply('hello', {})).toBe('hello')
  })

  it('unescapes unicode sequences', () => {
    expect(util.apply('\\u0041', {})).toBe('A')
  })

  it('roundtrips with json_escape', async () => {
    const escapeUtil = (await import('../json_escape/index')).default
    const original = 'hello "world"\nnew\tline'
    const escaped = escapeUtil.apply(original, {}) as string
    expect(util.apply(escaped, {})).toBe(original)
  })
})
