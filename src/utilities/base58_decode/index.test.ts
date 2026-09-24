import { describe, it, expect } from 'vitest'
import util from './index'
import encoder from '../base58_encode/index'

const hex = (h: string) => new Uint8Array((h.match(/../g) || []).map(x => parseInt(x, 16)))

describe('base58_decode', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('base58_decode')
    expect(util.name).toBe('base58 decode')
    expect(util.category).toBe('Decoding')
    expect(util.accepts).toBe('string')
    expect(util.produces).toEqual(['string', 'bytes'])
  })

  it('decodes Bitcoin-alphabet Base58', async () => {
    expect(await util.apply('2NEpo7TZRRrLZSi2U', {})).toBe('Hello World!')
    expect(await util.apply('8wr', {})).toBe('hi')
    expect(await util.apply('USm3fpXnKG5EUBx2ndxBDMPVciP5hGey2Jh4NDv6gmeo1LkMeiKrLJUUBk6Z', {})).toBe(
      'The quick brown fox jumps over the lazy dog.'
    )
  })

  it('returns empty output for empty input', async () => {
    expect(await util.apply('', {})).toBe('')
    expect(await util.apply('  \n ', {})).toBe('')
    expect(await util.apply('', { output: 'bytes' })).toEqual(new Uint8Array([]))
  })

  it('decodes non-ASCII text back to UTF-8', async () => {
    expect(await util.apply('CDK2VUL', {})).toBe('café')
    expect(await util.apply('79jdxj', {})).toBe('🚀')
  })

  it('decodes the published Bitcoin base58 test vectors', async () => {
    expect(await util.apply('2cFupjhnEsSn59qHXstmK2ffpLv2', {})).toBe('simply a long string')
    expect(await util.apply('ABnLTmg', { output: 'bytes' })).toEqual(hex('516b6fcd0f'))
    expect(await util.apply('3SEo3LWLoPntC', { output: 'bytes' })).toEqual(hex('bf4f89001e670274dd'))
    expect(await util.apply('1111111111', { output: 'bytes' })).toEqual(new Uint8Array(10))
    // a real mainnet address decodes to 25 bytes whose first byte is the 0x00 version
    expect(await util.apply('1NS17iag9jJgTHD1VXjvLCEnZuQ3rJDE9L', { output: 'bytes' })).toEqual(
      hex('00eb15231dfceb60925886b67d065299925915aeb172c06647')
    )
  })

  it('tolerates whitespace anywhere in the input', async () => {
    expect(await util.apply(' 2NEpo7TZ RRrLZ\nSi2U\t', {})).toBe('Hello World!')
  })

  it('decodes high bytes (0x80-0xFF) for every alphabet', async () => {
    const hi = hex('80ff00fe')
    expect(await util.apply('4JF4ww', { output: 'bytes' })).toEqual(hi)
    expect(await util.apply('hJEhAA', { alphabet: 'ripple', output: 'bytes' })).toEqual(hi)
    expect(await util.apply('4if4WW', { alphabet: 'flickr', output: 'bytes' })).toEqual(hi)
  })

  it('supports the ripple and flickr alphabets', async () => {
    expect(await util.apply('p4NFofTZRRiLZS5p7', { alphabet: 'ripple' })).toBe('Hello World!')
    expect(await util.apply('UDKpV7L', { alphabet: 'ripple' })).toBe('café')
    expect(await util.apply('2nePN7syqqRkyrH2t', { alphabet: 'flickr' })).toBe('Hello World!')
    expect(await util.apply('cdj2utk', { alphabet: 'flickr' })).toBe('café')
  })

  it('restores leading zero bytes and returns raw bytes when asked', async () => {
    expect(await util.apply('11233QC4', { output: 'bytes' })).toEqual(
      new Uint8Array([0x00, 0x00, 0x28, 0x7f, 0xb4, 0xcd])
    )
    expect(await util.apply('11', { output: 'bytes' })).toEqual(new Uint8Array([0, 0]))
    expect(await util.apply('rr', { alphabet: 'ripple', output: 'bytes' })).toEqual(new Uint8Array([0, 0]))
  })

  it('is case-sensitive and rejects the excluded ambiguous characters', () => {
    expect(() => util.apply('8wr0', {})).toThrow(/invalid base58 character: "0"/)
    expect(() => util.apply('8wrO', {})).toThrow(/invalid base58 character: "O"/)
    expect(() => util.apply('8wrl', {})).toThrow(/invalid base58 character: "l"/)
    expect(() => util.apply('8wrI', {})).toThrow(/invalid base58 character: "I"/)
    expect(() => util.apply('café', {})).toThrow(/invalid base58 character/)
    expect(() => util.apply('2NEpo7TZRRrLZSi2U', { alphabet: 'atlantis' })).toThrow(
      /unknown base58 alphabet/
    )
  })

  it('throws when the decoded bytes are not valid UTF-8 text', async () => {
    const encoded = await encoder.apply(new Uint8Array([0xff, 0xfe]), {})
    expect(() => util.apply(encoded, {})).toThrow(/not valid UTF-8/)
  })

  it('round-trips text encoded by base58_encode, including Unicode', async () => {
    for (const sample of ['Hello World!', 'naïve café', '日本語 🚀', 'a']) {
      const encoded = await encoder.apply(sample, {})
      expect(await util.apply(encoded, {})).toBe(sample)
    }
  })
})
