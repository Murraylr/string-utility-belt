import { describe, it, expect } from 'vitest'
import util from './index'

const OPENER =
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor ' +
  'incididunt ut labore et dolore magna aliqua.'

const SEEDED_WORDS_5 = 'distinctio tempore possimus quod laboriosam'

const sentenceCount = (s: string) => (s.match(/\./g) || []).length

describe('lorem_ipsum', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('lorem_ipsum')
    expect(util.name).toBe('lorem ipsum')
    expect(util.category).toBe('Generators')
    expect(util.accepts).toBe('string')
    expect(util.produces).toBe('string')
  })

  it('generates paragraphs starting with the classic opener', async () => {
    const out = String(await util.apply('', { unit: 'paragraphs', count: 3, seed: 9 }))
    const paras = out.split('\n\n')
    expect(paras).toHaveLength(3)
    expect(out.startsWith(OPENER)).toBe(true)
    expect(paras.every((p) => p.endsWith('.'))).toBe(true)
    // every paragraph is a real multi-sentence paragraph, not one stray line
    expect(paras.every((p) => sentenceCount(p) >= 3)).toBe(true)
    expect(paras.every((p) => !p.includes('\n'))).toBe(true)
  })

  it('omits the opener when startWithLorem is off and still writes real prose', async () => {
    const out = String(await util.apply('', { unit: 'paragraphs', count: 1, startWithLorem: false, seed: 9 }))
    expect(out.startsWith('Lorem ipsum')).toBe(false)
    expect(out).toMatch(/^[A-Z][a-z]+( [a-z,]+)+\./)
    expect(sentenceCount(out)).toBeGreaterThanOrEqual(3)
    // pure ASCII vocabulary, single-spaced, no dangling punctuation
    expect(out).toMatch(/^[\x20-\x7e]+$/)
    expect(out).not.toMatch(/ {2}| ,|,\.|\.\./)
  })

  it('wraps output in paragraph tags when html is on', async () => {
    const out = String(await util.apply('', { unit: 'paragraphs', count: 2, html: true, seed: 4 }))
    const lines = out.split('\n')
    expect(lines).toHaveLength(2)
    expect(lines.every((l) => l.startsWith('<p>') && l.endsWith('</p>'))).toBe(true)

    const sentences = String(await util.apply('', { unit: 'sentences', count: 2, html: true, seed: 4 }))
    expect(sentences.startsWith('<p>')).toBe(true)
    expect(sentences.endsWith('</p>')).toBe(true)

    // the tag must not eat into the requested byte budget
    const bytes = String(await util.apply('', { unit: 'bytes', count: 60, html: true, seed: 4 }))
    expect(bytes.slice(3, -4)).toHaveLength(60)

    const plain = String(await util.apply('', { unit: 'sentences', count: 2, html: false, seed: 4 }))
    expect(plain).not.toContain('<p>')
  })

  it('generates an exact number of sentences and words', async () => {
    for (const count of [1, 2, 5]) {
      const out = String(await util.apply('', { unit: 'sentences', count, seed: 11 }))
      expect(sentenceCount(out)).toBe(count)
    }
    expect(String(await util.apply('', { unit: 'sentences', count: 4, seed: 11 })).startsWith(OPENER)).toBe(true)

    expect(String(await util.apply('', { unit: 'words', count: 5, seed: 11 })))
      .toBe('lorem ipsum dolor sit amet')
    // crossing the 19-word opener into sampled words still lands on the exact count
    for (const count of [19, 20, 40]) {
      expect(String(await util.apply('', { unit: 'words', count, seed: 11 })).split(' ')).toHaveLength(count)
    }
    expect(await util.apply('', { unit: 'words', count: 5, startWithLorem: false, seed: 11 }))
      .toBe(SEEDED_WORDS_5)
    expect(String(await util.apply('', { unit: 'words', count: 40, seed: 11 })).split(' ')
      .every((w) => /^[a-z]+$/.test(w))).toBe(true)
  })

  it('generates an exact byte count', async () => {
    for (const count of [1, 60, 120, 900]) {
      for (const startWithLorem of [true, false]) {
        const out = String(await util.apply('', { unit: 'bytes', count, startWithLorem, seed: 2 }))
        expect(new TextEncoder().encode(out)).toHaveLength(count)
      }
    }
    expect(String(await util.apply('', { unit: 'bytes', count: 120, seed: 2 })).startsWith('Lorem ipsum')).toBe(true)
    expect(String(await util.apply('', { unit: 'bytes', count: 120, startWithLorem: false, seed: 2 }))
      .startsWith('Lorem ipsum')).toBe(false)
  })

  it('is deterministic when seeded and random when not', async () => {
    const a = await util.apply('', { unit: 'sentences', count: 3, startWithLorem: false, seed: 77 })
    const b = await util.apply('', { unit: 'sentences', count: 3, startWithLorem: false, seed: 77 })
    const c = await util.apply('', { unit: 'sentences', count: 3, startWithLorem: false, seed: 78 })
    expect(a).toBe(b)
    expect(a).not.toBe(c)

    const r1 = await util.apply('', { unit: 'sentences', count: 6, startWithLorem: false })
    const r2 = await util.apply('', { unit: 'sentences', count: 6, startWithLorem: false })
    expect(r1).not.toBe(r2)
    // the unseeded path must still honour the requested shape
    expect(sentenceCount(String(r1))).toBe(6)
  })

  it('ignores the input, including non-ASCII text, and handles a zero count', async () => {
    expect(await util.apply('🎉 naïve 日本語', { unit: 'words', count: 3, seed: 5 }))
      .toBe(await util.apply('', { unit: 'words', count: 3, seed: 5 }))
    expect(String(await util.apply('', {})).split('\n\n')).toHaveLength(3)
    expect(await util.apply('', { count: 0 })).toBe('')
    expect(await util.apply('', { unit: 'bytes', count: 0 })).toBe('')
    expect(await util.apply('', { unit: 'words', count: 0 })).toBe('')
  })

  it('rejects invalid counts and units', () => {
    expect(() => util.apply('', { count: -1 })).toThrow(/count must be zero or more/)
    expect(() => util.apply('', { count: 20000 })).toThrow(/count must be 10000 or less/)
    expect(() => util.apply('', { unit: 'bytes', count: 2000000 })).toThrow(/count must be 1000000 or less/)
    expect(() => util.apply('', { unit: 'chapters', count: 2 })).toThrow(/unknown unit/)
    // a bad unit must not be swallowed by the zero-count short circuit
    expect(() => util.apply('', { unit: 'chapters', count: 0 })).toThrow(/unknown unit/)
  })
})
