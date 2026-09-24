import { describe, it, expect } from 'vitest'
import util from './index'

describe('url_encode', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('url_encode')
    expect(util.name).toBe('url encode')
    expect(util.category).toBe('URL & JSON')
    expect(util.accepts).toBe('string')
    expect(util.produces).toBe('string')
  })

  it('encodes spaces', () => {
    expect(util.apply('hello world', {})).toBe('hello%20world')
  })

  it('encodes special characters', () => {
    expect(util.apply('a&b=c', {})).toBe('a%26b%3Dc')
  })

  it('leaves alphanumerics unchanged', () => {
    expect(util.apply('abc123', {})).toBe('abc123')
  })

  it('handles empty string', () => {
    expect(util.apply('', {})).toBe('')
  })

  it('encodes unicode characters', () => {
    expect(util.apply('✓', {})).toBe('%E2%9C%93')
  })

  it('encodes path separators', () => {
    expect(util.apply('/path/to/file', {})).toBe('%2Fpath%2Fto%2Ffile')
  })

  it('leaves unreserved characters unchanged', () => {
    // encodeURIComponent leaves - _ . ~ ! ' ( ) * unchanged
    expect(util.apply('a-b_c.d~e', {})).toBe('a-b_c.d~e')
  })
})
