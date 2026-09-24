import { describe, it, expect } from 'vitest'
import util from './index'

const sortedCodePoints = (s: string) => Array.from(s).sort().join('')

describe('shuffle', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('shuffle')
    expect(util.name).toBe('shuffle')
    expect(util.category).toBe('Generators')
    expect(util.accepts).toBe('string')
    expect(util.produces).toBe('string')
    expect(Object.keys(util.params)).toEqual(['unit', 'seed'])
  })

  it('shuffles lines reproducibly for a non-zero seed', async () => {
    const input = 'one\ntwo\nthree\nfour\nfive'
    const a = await util.apply(input, { unit: 'lines', seed: 12345 })
    const b = await util.apply(input, { unit: 'lines', seed: 12345 })
    expect(a).toBe(b)
    expect(a).toBe('one\nthree\nfour\ntwo\nfive')
    expect(String(a).split('\n').sort()).toEqual(input.split('\n').sort())
  })

  it('produces a different order for a different seed', async () => {
    const input = Array.from({ length: 12 }, (_, i) => `line ${i}`).join('\n')
    const a = await util.apply(input, { unit: 'lines', seed: 1 })
    const b = await util.apply(input, { unit: 'lines', seed: 2 })
    expect(a).not.toBe(b)
    expect(a).not.toBe(input)
  })

  it('returns empty string for empty input', async () => {
    expect(await util.apply('', {})).toBe('')
    expect(await util.apply('', { unit: 'words', seed: 7 })).toBe('')
    expect(await util.apply('', { unit: 'characters', seed: 7 })).toBe('')
  })

  it('keeps a trailing newline at the end', async () => {
    const out = String(await util.apply('a\nb\nc\n', { unit: 'lines', seed: 99 }))
    expect(out.endsWith('\n')).toBe(true)
    expect(out.split('\n').sort()).toEqual(['', 'a', 'b', 'c'])
  })

  it('shuffles words while preserving whitespace layout', async () => {
    const input = 'alpha beta gamma\ndelta epsilon zeta'
    const out = String(await util.apply(input, { unit: 'words', seed: 42 }))
    // Exact value: the shape/multiset checks below hold even for a lines shuffle,
    // so without this the test cannot tell the two units apart.
    expect(out).toBe('beta alpha epsilon\nzeta gamma delta')
    expect(out.replace(/\S+/gu, '#')).toBe(input.replace(/\S+/gu, '#'))
    expect((out.match(/\S+/gu) ?? []).sort()).toEqual((input.match(/\S+/gu) ?? []).sort())
    expect(out).not.toBe(await util.apply(input, { unit: 'lines', seed: 42 }))
  })

  it('shuffles characters as a permutation with whitespace pinned', async () => {
    const input = 'abcdef ghijkl'
    const out = String(await util.apply(input, { unit: 'characters', seed: 2024 }))
    expect(out).toBe('idfbac kelghj')
    expect(out).not.toBe(input)
    expect(out[6]).toBe(' ')
    expect(sortedCodePoints(out)).toBe(sortedCodePoints(input))
  })

  it('treats cleared param fields as their declared defaults', async () => {
    // The params editor emits '' for a cleared number field and Number('') is 0.
    const out = String(await util.apply('a\nb\nc', { unit: '', seed: '' }))
    expect(out.split('\n').sort()).toEqual(['a', 'b', 'c'])
    expect(await util.apply('a\nb\nc', { unit: '', seed: 12345 }))
      .toBe(await util.apply('a\nb\nc', { unit: 'lines', seed: 12345 }))
  })

  it('never splits astral characters', async () => {
    const input = 'a👍b🎉c🚀'
    const out = String(await util.apply(input, { unit: 'characters', seed: 5 }))
    expect(Array.from(out).sort()).toEqual(Array.from(input).sort())
    expect(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/.test(out)).toBe(false)
  })

  it('uses real randomness when the seed is 0', async () => {
    const input = Array.from({ length: 30 }, (_, i) => `l${i}`).join('\n')
    const runs = new Set<string>()
    for (let i = 0; i < 8; i++) runs.add(String(await util.apply(input, { unit: 'lines', seed: 0 })))
    expect(runs.size).toBeGreaterThan(1)
    for (const r of runs) expect(r.split('\n').sort()).toEqual(input.split('\n').sort())
  })

  it('throws on an unknown unit', () => {
    expect(() => util.apply('a b c', { unit: 'sentences' })).toThrow(/unknown unit/)
  })
})
