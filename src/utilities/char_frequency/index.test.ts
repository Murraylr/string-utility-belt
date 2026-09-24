import { describe, it, expect } from 'vitest'
import util from './index'

describe('char_frequency', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('char_frequency')
    expect(util.name).toBe('character frequency')
    expect(util.category).toBe('Analysis')
    expect(util.accepts).toBe('string')
    expect(util.produces).toEqual(['string', 'json'])
  })

  it('counts characters with percentages, most frequent first', async () => {
    expect(await util.apply('hello', {})).toBe(
      ['l  2  40.00%', 'e  1  20.00%', 'h  1  20.00%', 'o  1  20.00%'].join('\n')
    )
  })

  it('returns empty output for empty input', async () => {
    expect(await util.apply('', {})).toBe('')
    const json = (await util.apply('', { format: 'json' })) as any
    expect(json).toEqual({ totalCharacters: 0, uniqueCharacters: 0, characters: [] })
  })

  it('drops the percent column when percent is false', async () => {
    expect(await util.apply('hello', { percent: false })).toBe(['l  2', 'e  1', 'h  1', 'o  1'].join('\n'))
    const json = (await util.apply('aab', { format: 'json', percent: false })) as any
    expect(json.characters[0]).toEqual({ char: 'a', codePoint: 'U+0061', count: 2 })
  })

  it('folds case only when ignoreCase is true', async () => {
    expect(await util.apply('AaB', { ignoreCase: true })).toBe(['a  2  66.67%', 'b  1  33.33%'].join('\n'))
    expect(await util.apply('AaB', { ignoreCase: false })).toBe(
      ['A  1  33.33%', 'B  1  33.33%', 'a  1  33.33%'].join('\n')
    )
  })

  it('includes whitespace only when asked, showing it readably', async () => {
    expect(await util.apply('a b', { includeWhitespace: false })).toBe(
      ['a  1  50.00%', 'b  1  50.00%'].join('\n')
    )
    expect(await util.apply('a b', { includeWhitespace: true })).toBe(
      ['␣  1  33.33%', 'a  1  33.33%', 'b  1  33.33%'].join('\n')
    )
    expect(await util.apply('a\na', { includeWhitespace: true })).toBe(
      ['a   2  66.67%', '\\n  1  33.33%'].join('\n')
    )
  })

  it('honours the top limit', async () => {
    expect(await util.apply('aaabbc', { top: 2 })).toBe(
      ['a  3  50.00%', 'b  2  33.33%'].join('\n')
    )
    expect(await util.apply('aaabbc', { top: 0 })).toBe(
      ['a  3  50.00%', 'b  2  33.33%', 'c  1  16.67%'].join('\n')
    )
  })

  it('supports json and csv output', async () => {
    const json = (await util.apply('aab', { format: 'json' })) as any
    expect(typeof json).toBe('object')
    expect(json).toEqual({
      totalCharacters: 3,
      uniqueCharacters: 2,
      characters: [
        { char: 'a', codePoint: 'U+0061', count: 2, percent: 66.67 },
        { char: 'b', codePoint: 'U+0062', count: 1, percent: 33.33 }
      ]
    })
    expect(await util.apply('aab', { format: 'csv' })).toBe(
      'char,codePoint,count,percent\na,U+0061,2,66.67\nb,U+0062,1,33.33'
    )
    expect(await util.apply('a b', { format: 'csv', includeWhitespace: true, percent: false })).toBe(
      'char,codePoint,count\n" ",U+0020,1\na,U+0061,1\nb,U+0062,1'
    )
  })

  it('keeps astral characters whole', async () => {
    const json = (await util.apply('😀😀a', { format: 'json' })) as any
    expect(json.characters[0]).toEqual({ char: '😀', codePoint: 'U+1F600', count: 2, percent: 66.67 })
    expect(Array.from(String(json.characters[0].char))).toHaveLength(1)
    expect(await util.apply('😀😀a', {})).toBe(['😀  2  66.67%', 'a  1  33.33%'].join('\n'))
  })

  it('labels invisible characters instead of printing nothing', async () => {
    // U+200B is not JS whitespace, so it is counted; U+FEFF is, so it is skipped.
    expect(await util.apply('a\u200bb\ufeff', {})).toBe(
      ['a       1  33.33%', 'b       1  33.33%', 'U+200B  1  33.33%'].join('\n')
    )
    expect(await util.apply('a\ufeff', { includeWhitespace: true })).toBe(
      ['a       1  50.00%', 'U+FEFF  1  50.00%'].join('\n')
    )
    // A lone surrogate must not be emitted raw into the report.
    expect(await util.apply('\ud800', {})).toBe('U+D800  1  100.00%')
  })

  it('folds case only when the lower-case form stays one code point', async () => {
    // "İ".toLowerCase() is "i" + U+0307 — two code points, so it is left alone.
    const json = (await util.apply('\u0130i', { ignoreCase: true, format: 'json' })) as any
    expect(json.characters).toEqual([
      { char: 'i', codePoint: 'U+0069', count: 1, percent: 50 },
      { char: '\u0130', codePoint: 'U+0130', count: 1, percent: 50 }
    ])
  })

  it('throws on bad params', async () => {
    await expect(async () => await util.apply('hi', { format: 'xml' })).rejects.toThrow(/unknown format/)
    await expect(async () => await util.apply('hi', { top: -3 })).rejects.toThrow(/top must be/)
  })
})
