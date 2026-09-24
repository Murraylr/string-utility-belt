import { describe, it, expect } from 'vitest'
import util from './index'
import encoder from '../base32_encode/index'

describe('base32_decode', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('base32_decode')
    expect(util.name).toBe('base32 decode')
    expect(util.category).toBe('Decoding')
    expect(util.accepts).toBe('string')
    expect(util.produces).toEqual(['string', 'bytes'])
  })

  it('decodes the RFC 4648 test vectors', async () => {
    expect(await util.apply('MY======', {})).toBe('f')
    expect(await util.apply('MZXW6===', {})).toBe('foo')
    expect(await util.apply('MZXW6YTB', {})).toBe('fooba')
    expect(await util.apply('MZXW6YTBOI======', {})).toBe('foobar')
  })

  it('returns empty output for empty input', async () => {
    expect(await util.apply('', {})).toBe('')
    expect(await util.apply('   ', {})).toBe('')
    expect(await util.apply('', { output: 'bytes' })).toEqual(new Uint8Array([]))
  })

  it('tolerates missing padding, lowercase, and embedded whitespace', async () => {
    expect(await util.apply('MZXW6YTBOI', {})).toBe('foobar')
    expect(await util.apply('mzxw6ytboi', {})).toBe('foobar')
    expect(await util.apply('MZXW\n6YTB OI==\t====', {})).toBe('foobar')
  })

  it('decodes non-ASCII text back to UTF-8', async () => {
    expect(await util.apply('MNQWNQ5J', {})).toBe('café')
    expect(await util.apply('6CPZVAA=', {})).toBe('🚀')
  })

  it('supports the rfc4648-hex and z-base-32 variants', async () => {
    expect(await util.apply('CPNMUOJ1E8======', { variant: 'rfc4648-hex' })).toBe('foobar')
    expect(await util.apply('cpnmuoj1e8', { variant: 'rfc4648-hex' })).toBe('foobar')
    expect(await util.apply('c3zs6aubqe', { variant: 'z-base-32' })).toBe('foobar')
    expect(await util.apply('C3ZS6AUBQE', { variant: 'z-base-32' })).toBe('foobar')
    expect(await util.apply('pb1sa5dx', { variant: 'z-base-32' })).toBe('hello')
  })

  it('returns raw bytes when output is bytes', async () => {
    expect(await util.apply('MFRGG===', { output: 'bytes' })).toEqual(new Uint8Array([97, 98, 99]))
    expect(await util.apply('AAAGC===', { output: 'bytes' })).toEqual(new Uint8Array([0, 0, 97]))
    expect(await util.apply('777A====', { output: 'bytes' })).toEqual(new Uint8Array([255, 254]))
  })

  it('throws on invalid characters, invalid lengths, and unknown variants', () => {
    expect(() => util.apply('MZXW6YT!', {})).toThrow(/invalid base32 character/)
    expect(() => util.apply('MZXW6YTBO', {})).toThrow(/invalid base32 length/)
    expect(() => util.apply('MZXW6Y', {})).toThrow(/invalid base32 length/)
    expect(() => util.apply('01234567', {})).toThrow(/invalid base32 character/)
    expect(() => util.apply('MY======', { variant: 'nope' })).toThrow(/unknown base32 variant/)
  })

  it('reports a bad character rather than the length it also breaks', () => {
    // 9 characters (an invalid group size) AND an out-of-alphabet character: the
    // character is the actionable problem, so it must be the reported one.
    expect(() => util.apply('MZXW6YTB!', {})).toThrow(/invalid base32 character: "!"/)
  })

  it('rejects non-canonical encodings whose unused trailing bits are not zero', async () => {
    // "f" encodes canonically as MY; MZ carries the same 8 data bits plus a stray pad bit.
    expect(() => util.apply('MZ', {})).toThrow(/non-canonical/)
    // "foo" is MZXW6; MZXW7 differs only in the single unused bit.
    expect(() => util.apply('MZXW7===', {})).toThrow(/non-canonical/)
    // "foobar" is MZXW6YTBOI; ...OJ differs only in the two unused bits.
    expect(() => util.apply('MZXW6YTBOJ', {})).toThrow(/non-canonical/)
    // the canonical forms of the same values still decode
    expect(await util.apply('MY======', {})).toBe('f')
    expect(await util.apply('MZXW6===', {})).toBe('foo')
    expect(await util.apply('MZXW6YTBOI', {})).toBe('foobar')
  })

  it('applies the pad-bit rule to the other variants too', async () => {
    expect(() => util.apply('CP', { variant: 'rfc4648-hex' })).toThrow(/non-canonical/)
    expect(await util.apply('CO======', { variant: 'rfc4648-hex' })).toBe('f')
    expect(() => util.apply('c1', { variant: 'z-base-32' })).toThrow(/non-canonical/)
    expect(await util.apply('pb1sa5dx', { variant: 'z-base-32' })).toBe('hello')
  })

  it('throws when the decoded bytes are not valid UTF-8 text', () => {
    expect(() => util.apply('777A====', {})).toThrow(/not valid UTF-8/)
  })

  it('round-trips text encoded by base32_encode, including Unicode', async () => {
    for (const sample of ['fooba', 'naïve café', '日本語 🚀', 'a']) {
      const encoded = await encoder.apply(sample, {})
      expect(await util.apply(encoded, {})).toBe(sample)
    }
  })
})
