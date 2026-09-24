import { describe, it, expect } from 'vitest'
import util from './index'
import encoder from '../octal_encode/index'

describe('octal_decode', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('octal_decode')
    expect(util.name).toBe('octal decode')
    expect(util.category).toBe('Decoding')
    expect(util.accepts).toBe('string')
    expect(util.produces).toEqual(['string', 'bytes'])
    expect(Object.keys(util.params)).toEqual(['output'])
  })

  it('decodes space-separated triples', async () => {
    expect(await util.apply('110 151', {})).toBe('Hi')
  })

  it('returns the empty value for empty input', async () => {
    expect(await util.apply('', {})).toBe('')
    expect(await util.apply('  \n ', {})).toBe('')
    expect(await util.apply('', { output: 'bytes' })).toEqual(new Uint8Array([]))
  })

  it('tolerates backslashes, 0o prefixes, other separators and unseparated triples', async () => {
    expect(await util.apply('\\110\\151', {})).toBe('Hi')
    expect(await util.apply('0o110 0o151', {})).toBe('Hi')
    expect(await util.apply('110,151', {})).toBe('Hi')
    expect(await util.apply('110151', {})).toBe('Hi')
  })

  it('ignores any separator the encoder can emit, not just a punctuation whitelist', async () => {
    expect(await util.apply('110 => 151', {})).toBe('Hi')
    expect(await util.apply('110 · 151', {})).toBe('Hi')
    expect(await util.apply('110—151', {})).toBe('Hi')
    expect(await util.apply('110\t151', {})).toBe('Hi')
    expect(await util.apply('110_151', {})).toBe('Hi')
  })

  it('decodes non-ascii utf-8 sequences', async () => {
    expect(await util.apply('303 251', {})).toBe('é')
    expect(await util.apply('360 237 230 200', {})).toBe('😀')
  })

  it('can output raw bytes', async () => {
    expect(await util.apply('000 010 377', { output: 'bytes' })).toEqual(new Uint8Array([0, 8, 255]))
  })

  it('throws on invalid digits, oversized values, bad group lengths and non-utf-8 text', () => {
    expect(() => util.apply('119', {})).toThrow(/unexpected character "9"/)
    expect(() => util.apply('x41', {})).toThrow(/unexpected character "x"/)
    // a stray letter is junk, not a separator, even outside ASCII
    expect(() => util.apply('110é151', {})).toThrow(/unexpected character "é"/)
    expect(() => util.apply('400', {})).toThrow(/larger than one byte/)
    expect(() => util.apply('1234', {})).toThrow(/multiple of 3/)
    expect(() => util.apply('377', {})).toThrow(/not valid UTF-8/)
  })

  it('round-trips unicode and raw bytes through octal_encode', async () => {
    const text = 'Grüße 😀 — ok'
    expect(await util.apply(await encoder.apply(text, {}) as string, {})).toBe(text)
    expect(await util.apply(await encoder.apply(text, { separator: '' }) as string, {})).toBe(text)

    const bytes = new Uint8Array([0, 1, 127, 128, 254, 255])
    expect(await util.apply(await encoder.apply(bytes, {}) as string, { output: 'bytes' })).toEqual(bytes)
  })

  it('round-trips every separator the encoder offers', async () => {
    const bytes = new Uint8Array([0, 1, 65, 127, 128, 200, 254, 255])
    for (const separator of [' ', '', '-', ', ', ' | ', ' => ', ' · ', ' — ', '_', '+', '\\n']) {
      const encoded = await encoder.apply(bytes, { separator }) as string
      expect({ separator, out: await util.apply(encoded, { output: 'bytes' }) })
        .toEqual({ separator, out: bytes })
    }
  })
})
