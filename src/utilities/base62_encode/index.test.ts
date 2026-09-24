import { describe, it, expect } from 'vitest'
import util from './index'
import decoder from '../base62_decode/index'

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

describe('base62_encode', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('base62_encode')
    expect(util.name).toBe('base62 encode')
    expect(util.category).toBe('Encoding')
    expect(util.accepts).toEqual(['string', 'bytes'])
    expect(util.produces).toBe('string')
  })

  it('encodes with the standard alphabet by default', async () => {
    expect(await util.apply('Hello', {})).toBe('5TP3P3v')
    expect(await util.apply('hi', {})).toBe('6x7')
    expect(await util.apply('Hello, World!', {})).toBe('1wJfrzvdbtXUOlUjUf')
  })

  it('returns empty string for empty input', async () => {
    expect(await util.apply('', {})).toBe('')
    expect(await util.apply(new Uint8Array([]), {})).toBe('')
  })

  it('encodes non-ASCII text as UTF-8 bytes', async () => {
    expect(await util.apply('café', {})).toBe('7VuRskb')
    expect(await util.apply('🚀', {})).toBe('4PCnw0')
  })

  it('supports the inverted (lowercase-first) alphabet', async () => {
    expect(await util.apply('Hello', { alphabet: 'inverted' })).toBe('5tp3p3V')
    expect(await util.apply('hi', { alphabet: 'inverted' })).toBe('6X7')
    expect(await util.apply('café', { alphabet: 'inverted' })).toBe('7vUrSKB')
  })

  it('encodes high bytes (0x80-0xFF) exactly for both alphabets', async () => {
    const hi = hex('80ff00fe')
    expect(await util.apply(hi, {})).toBe('2MSk8M')
    expect(await util.apply(hi, { alphabet: 'inverted' })).toBe('2msK8m')
    expect(await util.apply(hex('fffe'), {})).toBe('H30')
  })

  it('encodes a longer realistic value', async () => {
    expect(await util.apply('The quick brown fox', {})).toBe('2uqFxlEY22QFH6f81G84eOYhM8')
    expect(await util.apply('The quick brown fox', { alphabet: 'inverted' })).toBe(
      '2UQfXLey22qfh6F81g84EoyHm8'
    )
  })

  it('emits leading zero bytes as leading "0" digits', async () => {
    expect(await util.apply(new Uint8Array([0, 0, 255]), {})).toBe('0047')
    expect(await util.apply(new Uint8Array([255, 255]), {})).toBe('H31')
    expect(await util.apply(new Uint8Array([0, 0, 0]), {})).toBe('000')
  })

  it('throws on an unknown alphabet', () => {
    expect(() => util.apply('hi', { alphabet: 'shuffled' })).toThrow(/unknown base62 alphabet/)
  })

  it('round-trips through base62_decode for both alphabets, including Unicode', async () => {
    const samples = ['Hello, World!', 'café — naïve', '🚀🎉 astral', '']
    for (const alphabet of ['standard', 'inverted']) {
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
      for (const alphabet of ['standard', 'inverted']) {
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
