import { describe, it, expect } from 'vitest'
import util from './index'

describe('atbash', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('atbash')
    expect(util.name).toBe('atbash')
    expect(util.category).toBe('Ciphers')
    expect(util.accepts).toBe('string')
    expect(util.produces).toBe('string')
    expect(util.params).toEqual({})
  })

  it('mirrors the alphabet in both cases', async () => {
    expect(await util.apply('abcxyz', {})).toBe('zyxcba')
    expect(await util.apply('ABCXYZ', {})).toBe('ZYXCBA')
  })

  it('encodes a realistic sentence', async () => {
    expect(await util.apply('Hello, World!', {})).toBe('Svool, Dliow!')
  })

  it('handles empty input without throwing', async () => {
    expect(await util.apply('', {})).toBe('')
  })

  it('is its own inverse', async () => {
    const source = 'The quick brown fox jumps over the lazy dog.'
    expect(await util.apply(await util.apply(source, {}), {})).toBe(source)
  })

  it('leaves digits, punctuation and whitespace untouched', async () => {
    expect(await util.apply('123 !?-\n\t', {})).toBe('123 !?-\n\t')
  })

  it('leaves non-ascii letters and emoji intact', async () => {
    expect(await util.apply('héllo 😀 Ω', {})).toBe('séool 😀 Ω')
    const out = String(await util.apply('a😀b', {}))
    expect(Array.from(out).length).toBe(3)
    expect(out).toBe('z😀y')
  })

  it('never throws, having no failure mode', async () => {
    expect(() => util.apply('', {})).not.toThrow()
    // an unpaired surrogate is passed through verbatim rather than corrupted or thrown on
    expect(await util.apply('\uD800 lone surrogate', {})).toBe('\uD800 olmv hfiiltzgv')
  })

  it('maps every letter of the alphabet exactly onto its mirror', async () => {
    const lower = 'abcdefghijklmnopqrstuvwxyz'
    expect(await util.apply(lower, {})).toBe('zyxwvutsrqponmlkjihgfedcba')
    expect(await util.apply(lower.toUpperCase(), {})).toBe('ZYXWVUTSRQPONMLKJIHGFEDCBA')
    // boundary characters either side of the two ranges must be untouched
    expect(await util.apply('@[`{', {})).toBe('@[`{')
  })
})
