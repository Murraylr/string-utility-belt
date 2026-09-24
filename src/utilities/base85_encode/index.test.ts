import { describe, it, expect } from 'vitest'
import util from './index'
import decoder from '../base85_decode/index'

describe('base85_encode', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('base85_encode')
    expect(util.name).toBe('base85 encode')
    expect(util.category).toBe('Encoding')
    expect(util.accepts).toEqual(['string', 'bytes'])
    expect(util.produces).toBe('string')
  })

  it('encodes the classic ascii85 vector', async () => {
    expect(await util.apply('Man is distinguished', {})).toBe('9jqo^BlbD-BleB1DJ+*+F(f,q')
    expect(await util.apply('hello', { variant: 'ascii85' })).toBe('BOu!rDZ')
  })

  it('returns empty string for empty input', async () => {
    expect(await util.apply('', {})).toBe('')
    expect(await util.apply(new Uint8Array([]), { delimiters: true })).toBe('')
  })

  it('wraps output in <~ ~> when delimiters is on', async () => {
    expect(await util.apply('Man is distinguished', { delimiters: true }))
      .toBe('<~9jqo^BlbD-BleB1DJ+*+F(f,q~>')
    expect(await util.apply('Man is distinguished', { delimiters: false }))
      .toBe('9jqo^BlbD-BleB1DJ+*+F(f,q')
  })

  it('encodes bytes and uses the z shortcut for zero groups', async () => {
    expect(await util.apply(new Uint8Array([0, 0, 0, 0, 65]), {})).toBe('z5l')
    expect(await util.apply(new Uint8Array([0xff, 0xfe, 0x01]), {})).toBe('s8E$')
  })

  it('encodes the z85 and rfc1924 variants', async () => {
    // ZeroMQ Z85 reference vector: 0x864FD26FB559F75B => "HelloWorld"
    const zmq = new Uint8Array([0x86, 0x4f, 0xd2, 0x6f, 0xb5, 0x59, 0xf7, 0x5b])
    expect(await util.apply(zmq, { variant: 'z85' })).toBe('HelloWorld')
    expect(await util.apply('hello', { variant: 'z85' })).toBe('xK#0@zV')
    expect(await util.apply('hello', { variant: 'rfc1924' })).toBe('Xk~0{Zv')
  })

  it('encodes non-ASCII text via UTF-8', async () => {
    expect(await util.apply('héllo ✓ 🎉', {})).toBe('BZ$fcCi:HUS<G)bT8na')
  })

  it('round-trips through base85_decode for every variant', async () => {
    for (const variant of ['ascii85', 'z85', 'rfc1924']) {
      const encoded = await util.apply('héllo ✓ 🎉 — astral survives', { variant })
      expect(await decoder.apply(encoded, { variant })).toBe('héllo ✓ 🎉 — astral survives')
    }
    const bytes = new Uint8Array([0, 0, 0, 0, 1, 2, 3, 250, 251, 252, 253, 254, 255])
    const encodedBytes = await util.apply(bytes, { variant: 'ascii85', delimiters: true })
    expect(Array.from(await decoder.apply(encodedBytes, { output: 'bytes' }) as Uint8Array))
      .toEqual(Array.from(bytes))
  })

  it('round-trips every tail alignment (guards the padding rule)', async () => {
    for (const variant of ['ascii85', 'z85', 'rfc1924']) {
      for (let len = 0; len <= 13; len++) {
        // 0x00 and 0xff runs exercise both the z shortcut and the 32-bit ceiling
        for (const fill of [0x00, 0xff, 0x80]) {
          const bytes = new Uint8Array(len).fill(fill)
          const encoded = await util.apply(bytes, { variant })
          const back = await decoder.apply(encoded, { variant, output: 'bytes' }) as Uint8Array
          expect(Array.from(back), `${variant} len=${len} fill=${fill}`).toEqual(Array.from(bytes))
        }
      }
    }
  })

  it('throws on an unknown variant', () => {
    expect(() => util.apply('abc', { variant: 'base85-deluxe' })).toThrow(/unknown base85 variant/)
  })
})
