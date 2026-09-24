import { describe, it, expect } from 'vitest'
import util from './index'
import decoder from '../rail_fence_decode/index'

describe('rail_fence_encode', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('rail_fence_encode')
    expect(util.name).toBe('rail fence encode')
    expect(util.category).toBe('Ciphers')
    expect(util.accepts).toBe('string')
    expect(util.produces).toBe('string')
  })

  it('encodes the classic example on three rails', async () => {
    expect(await util.apply('WEAREDISCOVEREDFLEEATONCE', { rails: 3 })).toBe('WECRLTEERDSOEEFEAOCAIVDEN')
  })

  it('defaults to 3 rails at offset 0', async () => {
    expect(await util.apply('ABCDEF', {})).toBe('AEBDFC')
    expect(await util.apply('WEAREDISCOVEREDFLEEATONCE', {})).toBe('WECRLTEERDSOEEFEAOCAIVDEN')
  })

  it('honours the rails parameter', async () => {
    expect(await util.apply('ABCDEF', { rails: 2 })).toBe('ACEBDF')
    expect(await util.apply('ABCDEF', { rails: 3 })).toBe('AEBDFC')
    // 4 rails: zigzag A/B/C/D/C/B -> rail0 "A", rail1 "BF", rail2 "CE", rail3 "D"
    expect(await util.apply('ABCDEF', { rails: 4 })).toBe('ABFCED')
    expect(await util.apply('ABCDEF', { rails: 6 })).toBe('ABCDEF')
  })

  it('stays linear in the input when rails far exceeds the text length', async () => {
    // `rails` is a free-form number input; the work must scale with the text,
    // not with the rail count, or a stray keystroke freezes the pipeline.
    const started = Date.now()
    expect(await util.apply('AB', { rails: 500_000_000 })).toBe('AB')
    expect(await util.apply('ABC', { rails: 10, offset: 4 })).toBe('ABC')
    expect(Date.now() - started).toBeLessThan(2000)
  })

  it('honours the offset parameter, including negative offsets', async () => {
    expect(await util.apply('ABCDEF', { rails: 3, offset: 0 })).toBe('AEBDFC')
    expect(await util.apply('ABCDEF', { rails: 3, offset: 1 })).toBe('DACEBF')
    expect(await util.apply('ABCDEF', { rails: 3, offset: -1 })).toBe('BFACED')
  })

  it('passes text through unchanged on a single rail', async () => {
    expect(await util.apply('ABCDEF', { rails: 1 })).toBe('ABCDEF')
    expect(await util.apply('ABCDEF', { rails: 1, offset: 5 })).toBe('ABCDEF')
  })

  it('handles empty input without throwing', async () => {
    expect(await util.apply('', {})).toBe('')
    expect(await util.apply('', { rails: 7, offset: 3 })).toBe('')
  })

  it('keeps astral characters intact', async () => {
    expect(await util.apply('a🌍bc', { rails: 2 })).toBe('ab🌍c')
    expect(Array.from(await util.apply('🌍🚀🎉', { rails: 2 }) as string)).toHaveLength(3)
  })

  it('round-trips through rail_fence_decode, including unicode', async () => {
    const plain = 'Attack at dawn — 🌍 café'
    for (const rails of [2, 3, 5]) {
      for (const offset of [0, 1, -2]) {
        const cipher = await util.apply(plain, { rails, offset })
        expect(await decoder.apply(cipher, { rails, offset })).toBe(plain)
      }
    }
  })

  it('throws on invalid rails or offset', async () => {
    await expect(async () => await util.apply('ABC', { rails: 0 })).rejects.toThrow(/at least 1/)
    await expect(async () => await util.apply('ABC', { rails: -3 })).rejects.toThrow(/at least 1/)
    await expect(async () => await util.apply('ABC', { rails: 2.5 })).rejects.toThrow(/whole number/)
    await expect(async () => await util.apply('ABC', { rails: 'many' })).rejects.toThrow(/whole number/)
    await expect(async () => await util.apply('ABC', { rails: 3, offset: 1.5 })).rejects.toThrow(/whole number/)
  })
})
