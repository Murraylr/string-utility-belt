import { describe, it, expect } from 'vitest'
import util from './index'
import encoder from '../base85_encode/index'

describe('base85_decode', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('base85_decode')
    expect(util.name).toBe('base85 decode')
    expect(util.category).toBe('Decoding')
    expect(util.accepts).toBe('string')
    expect(util.produces).toEqual(['string', 'bytes'])
  })

  it('decodes the classic ascii85 vector', async () => {
    expect(await util.apply('9jqo^BlbD-BleB1DJ+*+F(f,q', {})).toBe('Man is distinguished')
    expect(await util.apply('BOu!rDZ', { variant: 'ascii85' })).toBe('hello')
  })

  it('returns empty output for empty input', async () => {
    expect(await util.apply('', {})).toBe('')
    expect(Array.from(await util.apply('', { output: 'bytes' }) as Uint8Array)).toEqual([])
  })

  it('tolerates <~ ~> delimiters and embedded whitespace', async () => {
    expect(await util.apply('<~9jqo^Blb\n  D-BleB1DJ+*+F(f,q~>', {})).toBe('Man is distinguished')
  })

  it('supports the z and y shortcuts', async () => {
    expect(Array.from(await util.apply('z', { output: 'bytes' }) as Uint8Array)).toEqual([0, 0, 0, 0])
    expect(Array.from(await util.apply('y', { output: 'bytes' }) as Uint8Array))
      .toEqual([0x20, 0x20, 0x20, 0x20])
    expect(Array.from(await util.apply('z5l', { output: 'bytes' }) as Uint8Array))
      .toEqual([0, 0, 0, 0, 65])
    // 'z' is an ordinary data digit in z85, never a zero-group shortcut
    expect(Array.from(await util.apply('zzzzz', { variant: 'z85', output: 'bytes' }) as Uint8Array))
      .toEqual([110, 50, 6, 39])
  })

  it('only strips <~ ~> when they cannot be data (rfc1924 keeps them)', async () => {
    // In rfc1924 '<', '>' and '~' are all digits, so these are real payloads,
    // not delimited ones — stripping them would silently truncate the data.
    expect(Array.from(await util.apply('000~>', { variant: 'rfc1924', output: 'bytes' }) as Uint8Array))
      .toEqual([0, 0, 28, 47])
    expect(Array.from(await util.apply('<~000', { variant: 'rfc1924', output: 'bytes' }) as Uint8Array))
      .toEqual([230, 52, 252, 61])
    // a matched pair is still recognised for every variant
    expect(Array.from(await util.apply('<~000~>~>', { variant: 'rfc1924', output: 'bytes' }) as Uint8Array))
      .toEqual([0, 0, 28, 47])
    expect(await encoder.apply(new Uint8Array([0, 0, 28, 47]), { variant: 'rfc1924', delimiters: true }))
      .toBe('<~000~>~>')
    expect(await util.apply('<~9jqo^BlbD-BleB1DJ+*+F(f,q~>', { variant: 'ascii85' }))
      .toBe('Man is distinguished')
  })

  it('decodes the z85 and rfc1924 variants', async () => {
    expect(Array.from(await util.apply('HelloWorld', { variant: 'z85', output: 'bytes' }) as Uint8Array))
      .toEqual([0x86, 0x4f, 0xd2, 0x6f, 0xb5, 0x59, 0xf7, 0x5b])
    expect(await util.apply('xK#0@zV', { variant: 'z85' })).toBe('hello')
    expect(await util.apply('Xk~0{Zv', { variant: 'rfc1924' })).toBe('hello')
  })

  it('decodes non-ASCII text and round-trips the encoder output', async () => {
    expect(await util.apply('BZ$fcCi:HUS<G)bT8na', {})).toBe('héllo ✓ 🎉')
    const source = 'ünïcödé 🚀 round-trip'
    const encoded = await encoder.apply(source, { variant: 'ascii85', delimiters: true })
    expect(await util.apply(encoded, { variant: 'ascii85', output: 'text' })).toBe(source)
  })

  it('throws on malformed input', () => {
    expect(() => util.apply('9', {})).toThrow(/truncated/)
    expect(() => util.apply('9jqov', {})).toThrow(/invalid ascii85 character/)
    expect(() => util.apply('uuuuu', {})).toThrow(/overflows 32 bits/)
    expect(() => util.apply('9jz', {})).toThrow(/inside a base85 group/)
    expect(() => util.apply('Hello"orld', { variant: 'z85' })).toThrow(/invalid z85 character/)
    expect(() => util.apply('abc', { variant: 'nope' })).toThrow(/unknown base85 variant/)
    // astral characters are reported whole, not as two broken surrogate halves
    expect(() => util.apply('9j🎉qo', {})).toThrow(/invalid ascii85 character: "🎉"/)
  })

  it('reports binary payloads instead of mangling them as text', async () => {
    const encoded = await encoder.apply(new Uint8Array([0xff, 0xfe, 0x01]), {})
    expect(() => util.apply(encoded, { output: 'text' })).toThrow(/not valid UTF-8/)
    expect(Array.from(await util.apply(encoded, { output: 'bytes' }) as Uint8Array))
      .toEqual([0xff, 0xfe, 0x01])
  })
})
