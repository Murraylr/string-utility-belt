import { describe, it, expect } from 'vitest'
import util from './index'
import encoder from '../base64url_encode/index'

describe('base64url_decode', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('base64url_decode')
    expect(util.name).toBe('base64url decode')
    expect(util.category).toBe('Decoding')
    expect(util.accepts).toBe('string')
    expect(util.produces).toEqual(['string', 'bytes'])
  })

  it('decodes url-safe base64 without padding', async () => {
    expect(await util.apply('aGVsbG8gd29ybGQ', {})).toBe('hello world')
    expect(await util.apply('eyJhbGciOiJIUzI1NiJ9', {})).toBe('{"alg":"HS256"}')
  })

  it('accepts padding, whitespace, and the standard + / alphabet', async () => {
    expect(await util.apply('aGVsbG8gd29ybGQ=', {})).toBe('hello world')
    expect(await util.apply('aGVsbG8g\n  d29ybGQ=', {})).toBe('hello world')
    expect(Array.from(await util.apply('+/8=', { output: 'bytes' }) as Uint8Array)).toEqual([0xfb, 0xff])
    expect(Array.from(await util.apply('-_8', { output: 'bytes' }) as Uint8Array)).toEqual([0xfb, 0xff])
  })

  it('returns empty output for empty input', async () => {
    expect(await util.apply('', {})).toBe('')
    expect(Array.from(await util.apply('', { output: 'bytes' }) as Uint8Array)).toEqual([])
  })

  it('decodes non-ASCII text, keeping astral characters intact', async () => {
    expect(await util.apply('4pyT', {})).toBe('✓')
    expect(await util.apply('8J-OiQ', {})).toBe('🎉')
    expect(await util.apply('aMOpbGxvIOKckyDwn46J', { output: 'text' })).toBe('héllo ✓ 🎉')
  })

  it('emits raw bytes when output is bytes', async () => {
    expect(Array.from(await util.apply('AAEC_f7_', { output: 'bytes' }) as Uint8Array))
      .toEqual([0, 1, 2, 253, 254, 255])
    expect(Array.from(await util.apply('aGk', { output: 'bytes' }) as Uint8Array)).toEqual([104, 105])
    expect(Array.from(await util.apply('YQ==', { output: 'bytes' }) as Uint8Array)).toEqual([97])
  })

  it('round-trips the encoder output', async () => {
    const source = 'ünïcödé 🚀 round-trip'
    expect(await util.apply(await encoder.apply(source, { padding: true }), {})).toBe(source)
    expect(await util.apply(await encoder.apply(source, { padding: false }), {})).toBe(source)
  })

  it('throws on malformed input', () => {
    expect(() => util.apply('a', {})).toThrow(/lone trailing character/)
    expect(() => util.apply('aa$a', {})).toThrow(/invalid base64url character/)
    expect(() => util.apply('aa🎉aa', {})).toThrow(/invalid base64url character/)
    expect(() => util.apply('-_8', { output: 'text' })).toThrow(/not valid UTF-8/)
  })
})
