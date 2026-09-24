import { describe, it, expect } from 'vitest'
import util from './index'

describe('escape_html', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('escape_html')
    expect(util.category).toBe('Encoding')
    expect(util.accepts).toBe('string')
    expect(util.produces).toBe('string')
  })

  it('escapes ampersand', () => {
    expect(util.apply('a & b', {})).toBe('a &amp; b')
  })

  it('escapes angle brackets', () => {
    expect(util.apply('<div>', {})).toBe('&lt;div&gt;')
  })

  it('escapes quotes', () => {
    expect(util.apply('"hello" \'world\'', {})).toBe('&quot;hello&quot; &#39;world&#39;')
  })

  it('escapes all special chars together', () => {
    expect(util.apply('<a href="x">&', {})).toBe('&lt;a href=&quot;x&quot;&gt;&amp;')
  })

  it('handles empty string', () => {
    expect(util.apply('', {})).toBe('')
  })

  it('handles string with no special chars', () => {
    expect(util.apply('hello world', {})).toBe('hello world')
  })
})
