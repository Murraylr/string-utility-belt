import { describe, it, expect } from 'vitest'
import util from './index'

describe('unescape_html', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('unescape_html')
    expect(util.category).toBe('Decoding')
  })

  it('unescapes ampersand', () => {
    expect(util.apply('a &amp; b', {})).toBe('a & b')
  })

  it('unescapes angle brackets', () => {
    expect(util.apply('&lt;div&gt;', {})).toBe('<div>')
  })

  it('unescapes quotes', () => {
    expect(util.apply('&quot;hello&quot; &#39;world&#39;', {})).toBe('"hello" \'world\'')
  })

  it('handles empty string', () => {
    expect(util.apply('', {})).toBe('')
  })

  it('handles string with no entities', () => {
    expect(util.apply('hello', {})).toBe('hello')
  })

  it('roundtrips with escape_html', async () => {
    const escapeUtil = (await import('../escape_html/index')).default
    const original = '<script>alert("xss")</script>'
    const escaped = escapeUtil.apply(original, {}) as string
    expect(util.apply(escaped, {})).toBe(original)
  })
})
