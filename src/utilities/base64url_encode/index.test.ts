import { describe, it, expect } from 'vitest'
import util from './index'
import decoder from '../base64url_decode/index'

describe('base64url_encode', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('base64url_encode')
    expect(util.name).toBe('base64url encode')
    expect(util.category).toBe('Encoding')
    expect(util.accepts).toEqual(['string', 'bytes'])
    expect(util.produces).toBe('string')
  })

  it('encodes text without padding by default', async () => {
    expect(await util.apply('hello world', {})).toBe('aGVsbG8gd29ybGQ')
    expect(await util.apply('{"alg":"HS256"}', {})).toBe('eyJhbGciOiJIUzI1NiJ9')
  })

  it('adds = padding when padding is on', async () => {
    expect(await util.apply('hello world', { padding: true })).toBe('aGVsbG8gd29ybGQ=')
    expect(await util.apply('hello world', { padding: false })).toBe('aGVsbG8gd29ybGQ')
    expect(await util.apply('a', { padding: true })).toBe('YQ==')
  })

  it('returns empty string for empty input', async () => {
    expect(await util.apply('', {})).toBe('')
    expect(await util.apply(new Uint8Array([]), { padding: true })).toBe('')
  })

  it('uses - and _ instead of + and /', async () => {
    expect(await util.apply(new Uint8Array([0xfb, 0xff]), {})).toBe('-_8')
    expect(await util.apply(new Uint8Array([0xfb, 0xff]), { padding: true })).toBe('-_8=')
    expect(await util.apply(new Uint8Array([0, 1, 2, 253, 254, 255]), {})).toBe('AAEC_f7_')
  })

  it('encodes non-ASCII text via UTF-8, keeping astral characters intact', async () => {
    expect(await util.apply('✓', {})).toBe('4pyT')
    expect(await util.apply('🎉', {})).toBe('8J-OiQ')
    expect(await util.apply('héllo ✓ 🎉', {})).toBe('aMOpbGxvIOKckyDwn46J')
  })

  it('round-trips through base64url_decode', async () => {
    const source = 'héllo ✓ 🎉 — astral survives'
    expect(await decoder.apply(await util.apply(source, {}), {})).toBe(source)
    expect(await decoder.apply(await util.apply(source, { padding: true }), {})).toBe(source)
    const bytes = new Uint8Array([0, 1, 2, 250, 251, 252, 253, 254, 255])
    expect(Array.from(await decoder.apply(await util.apply(bytes, {}), { output: 'bytes' }) as Uint8Array))
      .toEqual(Array.from(bytes))
  })

  it('round-trips every tail alignment, padded and unpadded', async () => {
    for (let len = 0; len <= 12; len++) {
      for (const fill of [0x00, 0xff, 0x80]) {
        const bytes = new Uint8Array(len).fill(fill)
        for (const padding of [true, false]) {
          const encoded = await util.apply(bytes, { padding }) as string
          expect(encoded, `len=${len} pad=${padding}`).not.toMatch(/[+/]/)
          if (!padding) expect(encoded, `len=${len}`).not.toMatch(/=/)
          const back = await decoder.apply(encoded, { output: 'bytes' }) as Uint8Array
          expect(Array.from(back), `len=${len} fill=${fill} pad=${padding}`).toEqual(Array.from(bytes))
        }
      }
    }
  })

  it('has no failure mode — even lone surrogates encode instead of throwing', () => {
    // TextEncoder maps unpaired surrogates to U+FFFD, so encoding cannot fail.
    expect(() => util.apply('\uD83C', {})).not.toThrow()
    expect(() => util.apply('', { padding: true })).not.toThrow()
  })
})
