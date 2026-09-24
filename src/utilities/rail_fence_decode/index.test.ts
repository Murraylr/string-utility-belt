import { describe, it, expect } from 'vitest'
import util from './index'
import encoder from '../rail_fence_encode/index'

describe('rail_fence_decode', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('rail_fence_decode')
    expect(util.name).toBe('rail fence decode')
    expect(util.category).toBe('Ciphers')
    expect(util.accepts).toBe('string')
    expect(util.produces).toBe('string')
  })

  it('decodes the classic example on three rails', async () => {
    expect(await util.apply('WECRLTEERDSOEEFEAOCAIVDEN', { rails: 3 })).toBe('WEAREDISCOVEREDFLEEATONCE')
  })

  it('defaults to 3 rails at offset 0', async () => {
    expect(await util.apply('AEBDFC', {})).toBe('ABCDEF')
    expect(await util.apply('WECRLTEERDSOEEFEAOCAIVDEN', {})).toBe('WEAREDISCOVEREDFLEEATONCE')
  })

  it('honours the rails parameter', async () => {
    expect(await util.apply('ACEBDF', { rails: 2 })).toBe('ABCDEF')
    expect(await util.apply('AEBDFC', { rails: 3 })).toBe('ABCDEF')
    expect(await util.apply('ABFCED', { rails: 4 })).toBe('ABCDEF')
    expect(await util.apply('ABCDEF', { rails: 6 })).toBe('ABCDEF')
  })

  it('stays linear in the input when rails far exceeds the text length', async () => {
    const started = Date.now()
    expect(await util.apply('AB', { rails: 500_000_000 })).toBe('AB')
    expect(await util.apply('ABC', { rails: 10, offset: 4 })).toBe('ABC')
    expect(Date.now() - started).toBeLessThan(2000)
  })

  it('honours the offset parameter, including negative offsets', async () => {
    expect(await util.apply('DACEBF', { rails: 3, offset: 1 })).toBe('ABCDEF')
    expect(await util.apply('BFACED', { rails: 3, offset: -1 })).toBe('ABCDEF')
  })

  it('passes text through unchanged on a single rail', async () => {
    expect(await util.apply('ABCDEF', { rails: 1 })).toBe('ABCDEF')
  })

  it('handles empty input without throwing', async () => {
    expect(await util.apply('', {})).toBe('')
    expect(await util.apply('', { rails: 4, offset: 2 })).toBe('')
  })

  it('keeps astral characters intact', async () => {
    expect(await util.apply('ab🌍c', { rails: 2 })).toBe('a🌍bc')
  })

  it('round-trips the encoder output, including unicode', async () => {
    const plain = 'Meet me at the café 🌍 at noon'
    const cipher = await encoder.apply(plain, { rails: 4, offset: 2 })
    expect(cipher).not.toBe(plain)
    expect(await util.apply(cipher, { rails: 4, offset: 2 })).toBe(plain)
  })

  it('throws on invalid rails or offset', async () => {
    await expect(async () => await util.apply('ABC', { rails: 0 })).rejects.toThrow(/at least 1/)
    await expect(async () => await util.apply('ABC', { rails: 1.5 })).rejects.toThrow(/whole number/)
    await expect(async () => await util.apply('ABC', { rails: 3, offset: 'x' })).rejects.toThrow(/whole number/)
  })
})
