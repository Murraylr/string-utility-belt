import { describe, it, expect } from 'vitest'
import util from './index'
import decoder from '../base58_decode/index'

const hex = (h: string) => new Uint8Array((h.match(/../g) || []).map(x => parseInt(x, 16)))

/** Deterministic PRNG so the randomised round-trip below is reproducible. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

describe('base58_encode', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('base58_encode')
    expect(util.name).toBe('base58 encode')
    expect(util.category).toBe('Encoding')
    expect(util.accepts).toEqual(['string', 'bytes'])
    expect(util.produces).toBe('string')
  })

  it('encodes with the Bitcoin alphabet by default', async () => {
    expect(await util.apply('Hello World!', {})).toBe('2NEpo7TZRRrLZSi2U')
    expect(await util.apply('hi', {})).toBe('8wr')
    expect(await util.apply('The quick brown fox jumps over the lazy dog.', {})).toBe(
      'USm3fpXnKG5EUBx2ndxBDMPVciP5hGey2Jh4NDv6gmeo1LkMeiKrLJUUBk6Z'
    )
  })

  it('returns empty string for empty input', async () => {
    expect(await util.apply('', {})).toBe('')
    expect(await util.apply(new Uint8Array([]), {})).toBe('')
  })

  it('encodes non-ASCII text as UTF-8 bytes', async () => {
    expect(await util.apply('café', {})).toBe('CDK2VUL')
    expect(await util.apply('🚀', {})).toBe('79jdxj')
  })

  it('maps leading zero bytes to leading zero-digit characters', async () => {
    expect(await util.apply(new Uint8Array([0, 0]), {})).toBe('11')
    expect(await util.apply(new Uint8Array([0x00, 0x00, 0x28, 0x7f, 0xb4, 0xcd]), {})).toBe('11233QC4')
    expect(await util.apply(new Uint8Array([0, 0]), { alphabet: 'ripple' })).toBe('rr')
  })

  it('matches the published Bitcoin base58 test vectors', async () => {
    // bitcoin/src/test/data/base58_encode_decode.json
    expect(await util.apply('simply a long string', {})).toBe('2cFupjhnEsSn59qHXstmK2ffpLv2')
    expect(await util.apply(hex('516b6fcd0f'), {})).toBe('ABnLTmg')
    expect(await util.apply(hex('bf4f89001e670274dd'), {})).toBe('3SEo3LWLoPntC')
    expect(await util.apply(hex('ecac89cad93923c02321'), {})).toBe('EJDM8drfXA6uyA')
    expect(await util.apply(hex('00000000000000000000'), {})).toBe('1111111111')
    // a real mainnet address: version byte 0x00 must survive as the leading "1"
    expect(await util.apply(hex('00eb15231dfceb60925886b67d065299925915aeb172c06647'), {})).toBe(
      '1NS17iag9jJgTHD1VXjvLCEnZuQ3rJDE9L'
    )
  })

  it('encodes high bytes (0x80-0xFF) exactly for every alphabet', async () => {
    const hi = hex('80ff00fe')
    expect(await util.apply(hi, {})).toBe('4JF4ww')
    expect(await util.apply(hi, { alphabet: 'ripple' })).toBe('hJEhAA')
    expect(await util.apply(hi, { alphabet: 'flickr' })).toBe('4if4WW')
  })

  it('supports the ripple and flickr alphabets', async () => {
    expect(await util.apply('Hello World!', { alphabet: 'ripple' })).toBe('p4NFofTZRRiLZS5p7')
    expect(await util.apply('café', { alphabet: 'ripple' })).toBe('UDKpV7L')
    expect(await util.apply('Hello World!', { alphabet: 'flickr' })).toBe('2nePN7syqqRkyrH2t')
    expect(await util.apply('café', { alphabet: 'flickr' })).toBe('cdj2utk')
  })

  it('throws on an unknown alphabet', () => {
    expect(() => util.apply('hi', { alphabet: 'dogecoin' })).toThrow(/unknown base58 alphabet/)
  })

  it('round-trips through base58_decode for every alphabet, including Unicode', async () => {
    const samples = ['Hello World!', 'café — naïve', '🚀🎉 astral', '']
    for (const alphabet of ['bitcoin', 'ripple', 'flickr']) {
      for (const sample of samples) {
        const encoded = await util.apply(sample, { alphabet })
        expect(await decoder.apply(encoded, { alphabet })).toBe(sample)
      }
    }
  })

  it('round-trips arbitrary binary bytes including leading zeros', async () => {
    const bytes = new Uint8Array([0, 0, 1, 127, 128, 255, 254, 13, 10])
    const encoded = await util.apply(bytes, {})
    expect(await decoder.apply(encoded, { output: 'bytes' })).toEqual(bytes)
  })

  it('round-trips randomised byte strings of every length, biased to 0x00 and 0xFF', async () => {
    const rnd = mulberry32(0x5eed)
    const failures: string[] = []
    for (let len = 0; len <= 24; len++) {
      const bytes = new Uint8Array(len)
      for (let i = 0; i < len; i++) {
        const r = rnd()
        bytes[i] = r < 0.3 ? 0 : r < 0.5 ? 0xff : Math.floor(rnd() * 256)
      }
      for (const alphabet of ['bitcoin', 'ripple', 'flickr']) {
        const encoded = await util.apply(bytes, { alphabet })
        const back = await decoder.apply(encoded, { alphabet, output: 'bytes' })
        if (String(back) !== String(bytes)) {
          failures.push(`${alphabet} len=${len}: ${bytes} -> ${encoded} -> ${back}`)
        }
      }
    }
    expect(failures).toEqual([])
  })
})
