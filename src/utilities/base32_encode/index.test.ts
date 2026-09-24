import { describe, it, expect } from 'vitest'
import util from './index'
import decoder from '../base32_decode/index'

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

describe('base32_encode', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('base32_encode')
    expect(util.name).toBe('base32 encode')
    expect(util.category).toBe('Encoding')
    expect(util.accepts).toEqual(['string', 'bytes'])
    expect(util.produces).toBe('string')
  })

  it('matches the RFC 4648 test vectors', async () => {
    expect(await util.apply('f', {})).toBe('MY======')
    expect(await util.apply('fo', {})).toBe('MZXQ====')
    expect(await util.apply('foo', {})).toBe('MZXW6===')
    expect(await util.apply('foob', {})).toBe('MZXW6YQ=')
    expect(await util.apply('fooba', {})).toBe('MZXW6YTB')
    expect(await util.apply('foobar', {})).toBe('MZXW6YTBOI======')
  })

  it('returns empty string for empty input', async () => {
    expect(await util.apply('', {})).toBe('')
    expect(await util.apply(new Uint8Array([]), {})).toBe('')
  })

  it('encodes non-ASCII text as UTF-8 bytes', async () => {
    expect(await util.apply('café', {})).toBe('MNQWNQ5J')
    expect(await util.apply('🚀', {})).toBe('6CPZVAA=')
  })

  it('omits padding when padding is false', async () => {
    expect(await util.apply('foobar', { padding: false })).toBe('MZXW6YTBOI')
    expect(await util.apply('foo', { padding: false })).toBe('MZXW6')
    expect(await util.apply('fooba', { padding: false })).toBe('MZXW6YTB')
  })

  it('matches the RFC 4648 §10 base32hex test vectors', async () => {
    expect(await util.apply('f', { variant: 'rfc4648-hex' })).toBe('CO======')
    expect(await util.apply('fo', { variant: 'rfc4648-hex' })).toBe('CPNG====')
    expect(await util.apply('foo', { variant: 'rfc4648-hex' })).toBe('CPNMU===')
    expect(await util.apply('foob', { variant: 'rfc4648-hex' })).toBe('CPNMUOG=')
    expect(await util.apply('fooba', { variant: 'rfc4648-hex' })).toBe('CPNMUOJ1')
    expect(await util.apply('foobar', { variant: 'rfc4648-hex' })).toBe('CPNMUOJ1E8======')
  })

  it('supports the z-base-32 variant', async () => {
    expect(await util.apply('foobar', { variant: 'z-base-32', padding: false })).toBe('c3zs6aubqe')
    expect(await util.apply('hello', { variant: 'z-base-32' })).toBe('pb1sa5dx')
  })

  it('matches the z-base-32 specification test vectors', async () => {
    // From the z-base-32 spec: b2a(0xf0bfc7) == "6n9hq", b2a(0x8b8880) == "tqrey".
    expect(await util.apply(hex('f0bfc7'), { variant: 'z-base-32', padding: false })).toBe('6n9hq')
    expect(await util.apply(hex('8b8880'), { variant: 'z-base-32', padding: false })).toBe('tqrey')
  })

  it('encodes raw bytes including leading zeros', async () => {
    expect(await util.apply(new Uint8Array([97, 98, 99]), {})).toBe('MFRGG===')
    expect(await util.apply(new Uint8Array([0, 0, 97]), {})).toBe('AAAGC===')
  })

  it('throws on an unknown variant', () => {
    expect(() => util.apply('foo', { variant: 'base32000' })).toThrow(/unknown base32 variant/)
  })

  it('round-trips through base32_decode for every variant, including Unicode', async () => {
    const samples = ['foobar', 'café — naïve', '🚀🎉 astral', '']
    for (const variant of ['rfc4648', 'rfc4648-hex', 'z-base-32']) {
      for (const padding of [true, false]) {
        for (const sample of samples) {
          const encoded = await util.apply(sample, { variant, padding })
          expect(await decoder.apply(encoded, { variant })).toBe(sample)
        }
      }
    }
  })

  it('round-trips arbitrary binary bytes', async () => {
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
        bytes[i] = r < 0.25 ? 0 : r < 0.5 ? 0xff : Math.floor(rnd() * 256)
      }
      for (const variant of ['rfc4648', 'rfc4648-hex', 'z-base-32']) {
        for (const padding of [true, false]) {
          const encoded = await util.apply(bytes, { variant, padding })
          const back = await decoder.apply(encoded, { variant, output: 'bytes' })
          if (String(back) !== String(bytes)) {
            failures.push(`${variant} pad=${padding} len=${len}: ${bytes} -> ${encoded} -> ${back}`)
          }
          // padded output is always a whole number of 8-character groups
          if (padding) expect(String(encoded).length % 8).toBe(0)
        }
      }
    }
    expect(failures).toEqual([])
  })
})
