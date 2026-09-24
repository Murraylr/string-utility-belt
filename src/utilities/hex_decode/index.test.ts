import { describe, it, expect } from 'vitest'
import util from './index'

describe('hex_decode', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('hex_decode')
    expect(util.name).toBe('hex decode')
    expect(util.category).toBe('Decoding')
    expect(util.accepts).toBe('string')
    expect(util.produces).toBe('bytes')
  })

  it('decodes hex string to Uint8Array', () => {
    const out = util.apply('48656c6c6f', {})
    expect(out).toBeInstanceOf(Uint8Array)
    expect(Array.from(out as Uint8Array)).toEqual([0x48, 0x65, 0x6c, 0x6c, 0x6f])
  })

  it('decodes to correct UTF-8 text', () => {
    const out = util.apply('48656c6c6f', {})
    expect(new TextDecoder().decode(out as Uint8Array)).toBe('Hello')
  })

  it('decodes deadbeef', () => {
    const out = util.apply('deadbeef', {})
    expect(Array.from(out as Uint8Array)).toEqual([0xde, 0xad, 0xbe, 0xef])
  })

  it('handles empty string', () => {
    const out = util.apply('', {})
    expect(out).toBeInstanceOf(Uint8Array)
    expect((out as Uint8Array).length).toBe(0)
  })

  it('throws on odd-length hex', () => {
    expect(() => util.apply('abc', {})).toThrow()
  })

  it('throws on non-hex characters instead of fabricating bytes', () => {
    expect(() => util.apply('zz', {})).toThrow()
    expect(() => util.apply('0x41', {})).toThrow()
    expect(() => util.apply('4g', {})).toThrow()
    expect(() => util.apply('-1ff', {})).toThrow()
  })

  it('handles uppercase hex', () => {
    const out = util.apply('4A4B', {})
    expect(Array.from(out as Uint8Array)).toEqual([0x4a, 0x4b])
  })
})
