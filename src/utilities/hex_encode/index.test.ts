import { describe, it, expect } from 'vitest'
import util from './index'

describe('hex_encode', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('hex_encode')
    expect(util.name).toBe('hex encode')
    expect(util.category).toBe('Encoding')
    expect(util.accepts).toEqual(['string', 'bytes'])
    expect(util.produces).toBe('string')
  })

  it('encodes string to hex', () => {
    expect(util.apply('Hello', {})).toBe('48656c6c6f')
  })

  it('encodes full string correctly', () => {
    expect(util.apply('Hello my name is Murray', {}))
      .toBe('48656c6c6f206d79206e616d65206973204d7572726179')
  })

  it('encodes bytes (Uint8Array) to hex', () => {
    expect(util.apply(new Uint8Array([0xde, 0xad, 0xbe, 0xef]), {})).toBe('deadbeef')
  })

  it('handles empty string', () => {
    expect(util.apply('', {})).toBe('')
  })

  it('handles empty bytes', () => {
    expect(util.apply(new Uint8Array([]), {})).toBe('')
  })

  it('encodes single character', () => {
    expect(util.apply('A', {})).toBe('41')
  })

  it('encodes unicode via UTF-8 bytes', () => {
    // '✓' = U+2713 = UTF-8 bytes E2 9C 93
    expect(util.apply('✓', {})).toBe('e29c93')
  })
})
