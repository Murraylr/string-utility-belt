import { describe, it, expect } from 'vitest'
import util from './index'

describe('ngram_frequency', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('ngram_frequency')
    expect(util.name).toBe('n-gram frequency')
    expect(util.category).toBe('Analysis')
    expect(util.accepts).toBe('string')
    expect(util.produces).toEqual(['string', 'json'])
  })

  it('counts word bigrams by default', async () => {
    expect(await util.apply('a b a b', {})).toBe(['a b  2', 'b a  1'].join('\n'))
    const json = (await util.apply('the cat sat on the mat the cat', { format: 'json' })) as any
    expect(typeof json).toBe('object')
    expect(json.n).toBe(2)
    expect(json.unit).toBe('words')
    expect(json.totalNgrams).toBe(7)
    expect(json.uniqueNgrams).toBe(6)
    expect(json.ngrams[0]).toEqual({ ngram: 'the cat', count: 2 })
  })

  it('returns empty output for empty input', async () => {
    expect(await util.apply('', {})).toBe('')
    const json = (await util.apply('', { format: 'json' })) as any
    expect(json).toEqual({ n: 2, unit: 'words', totalNgrams: 0, uniqueNgrams: 0, ngrams: [] })
  })

  it('supports any n, including n larger than the input', async () => {
    expect(await util.apply('a b a', { n: 1 })).toBe(['a  2', 'b  1'].join('\n'))
    expect(await util.apply('one two three', { n: 3 })).toBe('one two three  1')
    expect(await util.apply('ab', { n: 5, unit: 'characters' })).toBe('')
  })

  it('counts character n-grams when unit=characters', async () => {
    expect(await util.apply('abcabc', { n: 3, unit: 'characters' })).toBe(
      ['abc  2', 'bca  1', 'cab  1'].join('\n')
    )
  })

  it('folds case only when ignoreCase is true', async () => {
    expect(await util.apply('Ab ab', { n: 1, ignoreCase: true })).toBe('ab  2')
    expect(await util.apply('Ab ab', { n: 1, ignoreCase: false })).toBe(['Ab  1', 'ab  1'].join('\n'))
  })

  it('honours the top limit', async () => {
    expect(await util.apply('a b a b a c', { n: 1, top: 1 })).toBe('a  3')
    expect(await util.apply('a b a b a c', { n: 1, top: 0 })).toBe(
      ['a  3', 'b  2', 'c  1'].join('\n')
    )
  })

  it('keeps astral characters whole in character n-grams', async () => {
    const json = (await util.apply('😀😀a', { n: 2, unit: 'characters', format: 'json' })) as any
    expect(json.totalNgrams).toBe(2)
    expect(json.ngrams.map((g: any) => g.ngram).sort()).toEqual(['😀a', '😀😀'].sort())
    const emojiPair = json.ngrams.find((g: any) => g.ngram === '😀😀')
    expect(Array.from(String(emojiPair.ngram))).toHaveLength(2)
  })

  it('keeps combining marks attached in decomposed (NFD) words', async () => {
    const nfd = 'naïve café naïve'.normalize('NFD')
    const json = (await util.apply(nfd, { n: 1, format: 'json' })) as any
    expect(json.ngrams).toEqual([
      { ngram: 'naïve'.normalize('NFD'), count: 2 },
      { ngram: 'café'.normalize('NFD'), count: 1 }
    ])
    // n a i U+0308 v e — one word, not "nai" + "ve".
    expect(Array.from(String(json.ngrams[0].ngram))).toHaveLength(6)
  })

  it('builds a table for result sets too large to spread into Math.max', async () => {
    const words = Array.from({ length: 200000 }, (_, i) => `w${i}`)
    const rows = String(await util.apply(words.join(' '), { n: 1, top: 0 })).split('\n')
    expect(rows).toHaveLength(200000)
    // Padded to the widest gram ("w199999", 7 chars) plus a two-space gutter.
    expect(rows[0]).toBe('w0'.padEnd(7) + '  1')
  })

  it('throws on bad params', async () => {
    await expect(async () => await util.apply('hi there', { n: 0 })).rejects.toThrow(/n must be 1/)
    await expect(async () => await util.apply('hi there', { n: -2 })).rejects.toThrow(/n must be 1/)
    await expect(async () => await util.apply('hi', { unit: 'lines' })).rejects.toThrow(/unknown unit/)
    await expect(async () => await util.apply('hi', { format: 'csv' })).rejects.toThrow(/unknown format/)
    await expect(async () => await util.apply('hi', { top: -1 })).rejects.toThrow(/top must be/)
  })
})
