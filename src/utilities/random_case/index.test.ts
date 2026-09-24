import { describe, it, expect } from 'vitest'
import util from './index'

const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])/

describe('random_case', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('random_case')
    expect(util.name).toBe('random case')
    expect(util.category).toBe('Formatting')
    expect(util.accepts).toBe('string')
    expect(util.produces).toBe('string')
    expect(Object.keys(util.params)).toEqual(['probability', 'seed'])
  })

  it('declares probability as a range param with the same default', () => {
    const spec = util.params.probability
    expect(spec.kind).toBe('range')
    expect(spec.default).toBe(0.5)
    if (spec.kind === 'range') {
      expect(spec.min).toBe(0)
      expect(spec.max).toBe(1)
      expect(spec.step).toBe(0.05)
    }
  })

  it('still accepts a legacy plain-number probability value', async () => {
    // Pipelines saved before the range upgrade stored a bare number; apply() must
    // keep treating it exactly as before.
    expect(await util.apply('Hello World', { probability: 1 })).toBe('HELLO WORLD')
    expect(await util.apply('Hello World', { probability: 0 })).toBe('hello world')
  })

  it('uppercases everything at probability 1 and lowercases at probability 0', async () => {
    expect(await util.apply('Hello World', { probability: 1 })).toBe('HELLO WORLD')
    expect(await util.apply('Hello World', { probability: 0 })).toBe('hello world')
  })

  it('is reproducible for a non-zero seed', async () => {
    const input = 'the quick brown fox'
    const a = await util.apply(input, { probability: 0.5, seed: 12345 })
    const b = await util.apply(input, { probability: 0.5, seed: 12345 })
    expect(a).toBe(b)
    expect(a).toBe('tHE quICk brOwn foX')
    expect(String(a).toLowerCase()).toBe(input)
  })

  it('honours probabilities strictly between 0 and 1', async () => {
    // Without these the suite passes even if `probability` is ignored for every
    // value in (0, 1) — 0/0.5/1 alone cannot tell a hard-coded 0.5 apart.
    const input = 'the quick brown fox'
    expect(await util.apply(input, { probability: 0.9, seed: 12345 })).toBe('tHE QUICK bROwN fOX')
    expect(await util.apply(input, { probability: 0.1, seed: 12345 })).toBe('the quiCk brown fox')
  })

  it('shifts the uppercase ratio with the probability', async () => {
    const input = 'abcdefghijklmnopqrstuvwxyz'.repeat(40)
    const ratio = async (p: number) => {
      const out = String(await util.apply(input, { probability: p, seed: 777 }))
      return Array.from(out).filter(c => c === c.toUpperCase()).length / out.length
    }
    expect(await ratio(0.1)).toBeLessThan(0.2)
    expect(await ratio(0.9)).toBeGreaterThan(0.8)
  })

  it('treats a cleared probability field as the 0.5 default', async () => {
    // The params editor emits '' for a cleared number field and Number('') is 0,
    // which would silently lowercase everything.
    expect(await util.apply('the quick brown fox', { probability: '', seed: 12345 })).toBe('tHE quICk brOwn foX')
    expect(await util.apply('the quick brown fox', { probability: '', seed: 12345 }))
      .toBe(await util.apply('the quick brown fox', { probability: 0.5, seed: 12345 }))
  })

  it('produces a different pattern for a different seed', async () => {
    const input = 'the quick brown fox jumps over the lazy dog'
    const a = await util.apply(input, { seed: 1 })
    const b = await util.apply(input, { seed: 2 })
    expect(a).not.toBe(b)
  })

  it('returns empty string for empty input', async () => {
    expect(await util.apply('', {})).toBe('')
    expect(await util.apply('', { probability: 1, seed: 5 })).toBe('')
    // Empty input must never throw, even with params that are otherwise rejected.
    expect(await util.apply('', { probability: 9 })).toBe('')
  })

  it('varies between runs when the seed is 0', async () => {
    const input = 'abcdefghijklmnopqrstuvwxyz'
    const runs = new Set<string>()
    for (let i = 0; i < 8; i++) runs.add(String(await util.apply(input, { probability: 0.5, seed: 0 })))
    expect(runs.size).toBeGreaterThan(1)
    for (const r of runs) expect(r.toLowerCase()).toBe(input)
  })

  it('handles non-ASCII letters and leaves other characters untouched', async () => {
    expect(await util.apply('über café', { probability: 1 })).toBe('ÜBER CAFÉ')
    expect(await util.apply('привет, мир!', { probability: 1 })).toBe('ПРИВЕТ, МИР!')
    const out = String(await util.apply('a\u{1F44D}b', { probability: 1, seed: 3 }))
    expect(out).toBe('A\u{1F44D}B')
    expect(LONE_SURROGATE.test(out)).toBe(false)
  })

  it('throws when probability is out of range', () => {
    expect(() => util.apply('abc', { probability: 1.5 })).toThrow(/between 0 and 1/)
    expect(() => util.apply('abc', { probability: -0.1 })).toThrow(/between 0 and 1/)
    expect(() => util.apply('abc', { probability: 'half' })).toThrow(/between 0 and 1/)
  })
})
