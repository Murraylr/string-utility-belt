import { describe, it, expect } from 'vitest'
import util from './index'

describe('word_frequency', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('word_frequency')
    expect(util.name).toBe('word frequency')
    expect(util.category).toBe('Analysis')
    expect(util.accepts).toBe('string')
    expect(util.produces).toEqual(['string', 'json'])
  })

  it('counts words into an aligned table, most frequent first', async () => {
    expect(await util.apply('the cat the hat the end', {})).toBe(
      ['the  3', 'cat  1', 'end  1', 'hat  1'].join('\n')
    )
  })

  it('returns empty output for empty input', async () => {
    expect(await util.apply('', {})).toBe('')
    const json = (await util.apply('', { format: 'json' })) as any
    expect(json).toEqual({ totalWords: 0, uniqueWords: 0, words: [] })
  })

  it('honours the top limit', async () => {
    expect(await util.apply('the cat the hat the end', { top: 2 })).toBe(['the  3', 'cat  1'].join('\n'))
    expect(await util.apply('the cat the hat the end', { top: 0 })).toBe(
      ['the  3', 'cat  1', 'end  1', 'hat  1'].join('\n')
    )
  })

  it('folds case only when ignoreCase is true', async () => {
    expect(await util.apply('The the THE', { ignoreCase: true })).toBe('the  3')
    expect(await util.apply('The the THE', { ignoreCase: false })).toBe(
      ['THE  1', 'The  1', 'the  1'].join('\n')
    )
  })

  it('removes english stop words when stopWords is true', async () => {
    expect(await util.apply('the cat and the hat', { stopWords: false })).toBe(
      ['the  2', 'and  1', 'cat  1', 'hat  1'].join('\n')
    )
    expect(await util.apply('the cat and the hat', { stopWords: true })).toBe(
      ['cat  1', 'hat  1'].join('\n')
    )
  })

  it('applies minLength', async () => {
    expect(await util.apply('a bb ccc dddd', { minLength: 3 })).toBe(['ccc   1', 'dddd  1'].join('\n'))
    expect(await util.apply('a bb ccc dddd', { minLength: 1 })).toBe(
      ['a     1', 'bb    1', 'ccc   1', 'dddd  1'].join('\n')
    )
  })

  it('keeps punctuation attached when stripPunctuation is false', async () => {
    expect(await util.apply('hi, hi', { stripPunctuation: true })).toBe('hi  2')
    expect(await util.apply('hi, hi', { stripPunctuation: false })).toBe(['hi   1', 'hi,  1'].join('\n'))
  })

  it('supports json and csv output', async () => {
    const json = (await util.apply('a a b', { format: 'json' })) as any
    expect(typeof json).toBe('object')
    expect(json).toEqual({
      totalWords: 3,
      uniqueWords: 2,
      words: [
        { word: 'a', count: 2 },
        { word: 'b', count: 1 }
      ]
    })
    expect(await util.apply('a a b', { format: 'csv' })).toBe('word,count\na,2\nb,1')
  })

  it('quotes csv cells that need it', async () => {
    expect(await util.apply('a,b a,b c', { format: 'csv', stripPunctuation: false })).toBe(
      'word,count\n"a,b",2\nc,1'
    )
  })

  it('handles accented words, keeps contractions whole and ignores emoji', async () => {
    expect(await util.apply('café Café naïve 😀', {})).toBe(['café   2', 'naïve  1'].join('\n'))
    expect(await util.apply("don't don't stop", {})).toBe(["don't  2", 'stop   1'].join('\n'))
  })

  it('keeps combining marks attached in decomposed (NFD) words', async () => {
    const nfd = 'café naïve café'.normalize('NFD')
    const json = (await util.apply(nfd, { format: 'json' })) as any
    expect(json).toEqual({
      totalWords: 3,
      uniqueWords: 2,
      words: [
        { word: 'café'.normalize('NFD'), count: 2 },
        { word: 'naïve'.normalize('NFD'), count: 1 }
      ]
    })
    // n a i U+0308 v e — one word, not "nai" + "ve".
    expect(Array.from(String(json.words[1].word))).toHaveLength(6)
  })

  it('builds a table for result sets too large to spread into Math.max', async () => {
    const words = Array.from({ length: 200000 }, (_, i) => `w${i}`)
    const table = String(await util.apply(words.join(' '), { top: 0 }))
    const rows = table.split('\n')
    expect(rows).toHaveLength(200000)
    // Padded to the widest word ("w199999", 7 chars) plus a two-space gutter.
    expect(rows[0]).toBe('w0'.padEnd(7) + '  1')
  })

  it('throws on bad params', async () => {
    await expect(async () => await util.apply('hi', { format: 'xml' })).rejects.toThrow(/unknown format/)
    await expect(async () => await util.apply('hi', { top: -1 })).rejects.toThrow(/top must be/)
    await expect(async () => await util.apply('hi', { minLength: -2 })).rejects.toThrow(
      /min word length must be/
    )
  })
})
