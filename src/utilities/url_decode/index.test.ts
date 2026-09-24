import { describe, it, expect } from 'vitest'
import util from './index'

describe('url_decode', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('url_decode')
    expect(util.name).toBe('url decode')
    expect(util.category).toBe('URL & JSON')
    expect(util.accepts).toBe('string')
    expect(util.produces).toBe('string')
  })

  it('decodes percent-encoded characters', () => {
    expect(util.apply('hello%20world', {})).toBe('hello world')
  })

  it('decodes special URL characters', () => {
    expect(util.apply('a%26b%3Dc', {})).toBe('a&b=c')
  })

  it('handles already-decoded string', () => {
    expect(util.apply('hello', {})).toBe('hello')
  })

  it('handles empty string', () => {
    expect(util.apply('', {})).toBe('')
  })

  it('decodes unicode characters', () => {
    expect(util.apply('%E2%9C%93', {})).toBe('✓')
  })

  it('throws on malformed percent encoding', () => {
    expect(() => util.apply('%ZZ', {})).toThrow()
  })

  it('decodes path separators', () => {
    expect(util.apply('%2Fpath%2Fto%2Ffile', {})).toBe('/path/to/file')
  })
})
