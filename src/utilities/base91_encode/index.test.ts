import { describe, it, expect } from 'vitest'
import util from './index'
import decoder from '../base91_decode/index'

describe('base91_encode', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('base91_encode')
    expect(util.name).toBe('basE91 encode')
    expect(util.category).toBe('Encoding')
    expect(util.accepts).toEqual(['string', 'bytes'])
    expect(util.produces).toBe('string')
    expect(util.params).toEqual({})
  })

  it('matches the reference basE91 vectors', async () => {
    expect(await util.apply('test', {})).toBe('fPNKd')
    expect(await util.apply('hello world', {})).toBe('TPwJh>Io2Tv!lE')
    expect(await util.apply('a', {})).toBe('GB')
  })

  it('returns empty string for empty input', async () => {
    expect(await util.apply('', {})).toBe('')
    expect(await util.apply(new Uint8Array([]), {})).toBe('')
  })

  it('encodes raw bytes', async () => {
    expect(await util.apply(new Uint8Array([0xff, 0xfe]), {})).toBe('S|H')
    expect(await util.apply(new Uint8Array([97, 98, 99]), {})).toBe('#G(I')
    expect(await util.apply('abc', {})).toBe('#G(I')
    // high bytes (0x80-0xff) survive without being mangled through UTF-8
    expect(await util.apply(new Uint8Array([0, 1, 2, 127, 128, 200, 253, 254, 255]), {}))
      .toBe(':C#(h",^_~#')
  })

  it('encodes non-ASCII text via UTF-8', async () => {
    expect(await util.apply('héllo ✓ 🎉', {})).toBe('1J_OX<oC*n1bnBW4@aE')
  })

  it('never emits space, apostrophe, backslash or hyphen', async () => {
    const encoded = String(await util.apply('The quick brown fox jumps over the lazy dog. 0123456789', {}))
    expect(encoded).not.toMatch(/[ '\\-]/)
  })

  it('round-trips through base91_decode, including binary data', async () => {
    const source = 'héllo ✓ 🎉 — astral survives'
    expect(await decoder.apply(await util.apply(source, {}), {})).toBe(source)
    const bytes = new Uint8Array([0, 1, 2, 127, 128, 200, 253, 254, 255])
    const encoded = await util.apply(bytes, {})
    expect(Array.from(await decoder.apply(encoded, { output: 'bytes' }) as Uint8Array))
      .toEqual(Array.from(bytes))
  })

  it('round-trips every input length (guards the 13/14-bit queue split)', async () => {
    for (let len = 0; len <= 20; len++) {
      for (const fill of [0x00, 0xff, 0x80, 0x55]) {
        const bytes = new Uint8Array(len).fill(fill)
        const back = await decoder.apply(await util.apply(bytes, {}), { output: 'bytes' }) as Uint8Array
        expect(Array.from(back), `len=${len} fill=${fill}`).toEqual(Array.from(bytes))
      }
    }
  })

  it('has no failure mode — even lone surrogates encode instead of throwing', () => {
    // TextEncoder maps unpaired surrogates to U+FFFD, so encoding cannot fail.
    expect(() => util.apply('\uD83C', {})).not.toThrow()
    expect(() => util.apply('', {})).not.toThrow()
  })
})
