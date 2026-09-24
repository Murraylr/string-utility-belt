import { describe, it, expect } from 'vitest'
import util from './index'

const run = async (input: string, params: Record<string, unknown> = {}) =>
  (await util.apply(input, params)) as Record<string, number | string>

describe('string_distance', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('string_distance')
    expect(util.name).toBe('string distance')
    expect(util.category).toBe('Analysis')
    expect(util.accepts).toBe('string')
    expect(util.produces).toBe('json')
  })

  it('computes levenshtein by default and returns a real object', async () => {
    const out = await util.apply('kitten', { other: 'sitting' })
    expect(typeof out).toBe('object')
    expect(out).toEqual({
      algorithm: 'levenshtein',
      distance: 3,
      similarity: 0.571429,
      a: 'kitten',
      b: 'sitting'
    })
  })

  it('treats transpositions as one edit for damerau-levenshtein', async () => {
    expect((await run('ca', { other: 'ac', algorithm: 'damerau-levenshtein' })).distance).toBe(1)
    expect((await run('ca', { other: 'ac', algorithm: 'levenshtein' })).distance).toBe(2)
  })

  it('computes hamming over code points and rejects length mismatches', async () => {
    expect((await run('karolin', { other: 'kathrin', algorithm: 'hamming' })).distance).toBe(3)
    // one astral code point vs one BMP character: equal length, no throw
    expect((await run('👍', { other: 'x', algorithm: 'hamming' })).distance).toBe(1)
    expect(() => util.apply('abc', { other: 'ab', algorithm: 'hamming' })).toThrow(/equal-length/)
  })

  it('computes jaro and jaro-winkler', async () => {
    const jaro = await run('MARTHA', { other: 'MARHTA', algorithm: 'jaro' })
    expect(jaro.similarity).toBe(0.944444)
    expect(jaro.distance).toBe(0.055556)
    const winkler = await run('MARTHA', { other: 'MARHTA', algorithm: 'jaro-winkler' })
    expect(winkler.similarity).toBe(0.961111)
    expect(winkler.distance).toBe(0.038889)
  })

  it('computes the bigram coefficients (dice, jaccard, cosine)', async () => {
    expect((await run('night', { other: 'nacht', algorithm: 'dice' })).similarity).toBe(0.25)
    expect((await run('night', { other: 'nacht', algorithm: 'jaccard' })).similarity).toBe(0.142857)
    // cosine uses bigram counts, so repeated grams behave differently from dice
    expect((await run('aaa', { other: 'aa', algorithm: 'cosine' })).similarity).toBe(1)
    expect((await run('aaa', { other: 'aa', algorithm: 'dice' })).similarity).toBe(0.666667)
  })

  it('computes the lcs edit distance', async () => {
    const out = await run('AGCAT', { other: 'GAC', algorithm: 'lcs' })
    expect(out.distance).toBe(4)
    expect(out.similarity).toBe(0.5)
  })

  it('honours normalized', async () => {
    expect((await run('kitten', { other: 'sitting', normalized: true })).distance).toBe(0.428571)
    expect((await run('kitten', { other: 'sitting', normalized: false })).distance).toBe(3)
  })

  it('honours ignoreCase', async () => {
    expect((await run('HELLO', { other: 'hello', ignoreCase: true })).distance).toBe(0)
    expect((await run('HELLO', { other: 'hello', ignoreCase: true })).similarity).toBe(1)
    expect((await run('HELLO', { other: 'hello', ignoreCase: false })).distance).toBe(5)
    // the reported strings stay untouched
    expect((await run('HELLO', { other: 'hello', ignoreCase: true })).a).toBe('HELLO')
  })

  it('counts unicode by code point', async () => {
    expect((await run('café', { other: 'cafe' })).distance).toBe(1)
    expect((await run('👍👍', { other: '👍' })).distance).toBe(1)
    expect((await run('🍕🍔', { other: '🍔🍕', algorithm: 'damerau-levenshtein' })).distance).toBe(1)
  })

  it('handles empty input without throwing', async () => {
    expect(await util.apply('', {})).toEqual({
      algorithm: 'levenshtein',
      distance: 0,
      similarity: 1,
      a: '',
      b: ''
    })
    expect((await run('', { other: 'abc' })).distance).toBe(3)
    expect((await run('', { other: 'abc' })).similarity).toBe(0)
    expect((await run('', { other: '', algorithm: 'jaro-winkler' })).similarity).toBe(1)
  })

  it('declares every manifest param with its default', () => {
    expect(Object.keys(util.params)).toEqual(['other', 'algorithm', 'ignoreCase', 'normalized'])
    const p = util.params as Record<string, { default?: unknown; options?: string[] }>
    expect(p.other.default).toBe('')
    expect(p.algorithm.default).toBe('levenshtein')
    expect(p.algorithm.options).toEqual([
      'levenshtein',
      'damerau-levenshtein',
      'hamming',
      'jaro',
      'jaro-winkler',
      'dice',
      'jaccard',
      'lcs',
      'cosine'
    ])
    expect(p.ignoreCase.default).toBe(false)
    expect(p.normalized.default).toBe(false)
  })

  it('reports the coefficients as a distance as well as a similarity', async () => {
    expect((await run('night', { other: 'nacht', algorithm: 'dice' })).distance).toBe(0.75)
    expect((await run('night', { other: 'nacht', algorithm: 'jaccard' })).distance).toBe(0.857143)
    expect((await run('night', { other: 'nacht', algorithm: 'cosine' })).distance).toBe(0.75)
    expect((await run('night', { other: 'nacht', algorithm: 'cosine' })).similarity).toBe(0.25)
  })

  it('never reports a negative or -0 distance for identical strings', async () => {
    // cosine('aa a','aa a') is 3 / (Math.sqrt(3) * Math.sqrt(3)) = 1.0000000000000002,
    // which without clamping turns into a similarity above 1 and a distance of -0.
    for (const algorithm of ['cosine', 'dice', 'jaccard', 'jaro', 'jaro-winkler', 'levenshtein']) {
      const out = await run('aa a', { other: 'aa a', algorithm })
      expect(Object.is(out.distance, 0)).toBe(true)
      expect(out.similarity).toBe(1)
      const normalized = await run('aa a', { other: 'aa a', algorithm, normalized: true })
      expect(Object.is(normalized.distance, 0)).toBe(true)
    }
  })

  it('detects transpositions far from the start of the strings', async () => {
    const pad = 'a'.repeat(50)
    expect((await run(pad + 'xy', { other: pad + 'yx', algorithm: 'damerau-levenshtein' })).distance).toBe(1)
    expect((await run('abcdefgh', { other: 'abcdefhg', algorithm: 'damerau-levenshtein' })).distance).toBe(1)
    expect((await run('abcdefgh', { other: 'abcdefhg', algorithm: 'levenshtein' })).distance).toBe(2)
  })

  it('throws on an unknown algorithm', () => {
    expect(() => util.apply('a', { algorithm: 'soundex' })).toThrow(/unknown algorithm/)
  })
})
