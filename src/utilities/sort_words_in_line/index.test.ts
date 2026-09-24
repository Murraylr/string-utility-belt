import { describe, it, expect } from 'vitest'
import util from './index'

describe('sort_words_in_line', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('sort_words_in_line')
    expect(util.name).toBe('sort words in each line')
    expect(util.category).toBe('Lines')
    expect(util.accepts).toBe('string')
    expect(util.produces).toBe('string')
    expect(Object.keys(util.params).sort()).toEqual(['direction', 'ignoreCase', 'separator', 'unique'])
  })

  it('sorts the words of a line ascending by default', async () => {
    expect(await util.apply('banana Apple cherry', {})).toBe('Apple banana cherry')
  })

  it('sorts descending', async () => {
    expect(await util.apply('banana Apple cherry', { direction: 'desc' })).toBe('cherry banana Apple')
  })

  it('sorts each line independently and preserves blank lines and CRLF', async () => {
    expect(await util.apply('b a\n\nd c', {})).toBe('a b\n\nc d')
    expect(await util.apply('b a\r\nd c', {})).toBe('a b\r\nc d')
    expect(await util.apply('b a\n', {})).toBe('a b\n')
  })

  it('treats runs of a blank separator as one separator', async () => {
    expect(await util.apply('b     a', {})).toBe('a b')
  })

  it('honours a custom separator, including empty fields', async () => {
    expect(await util.apply('b,a,c', { separator: ',' })).toBe('a,b,c')
    expect(await util.apply('b,,a', { separator: ',' })).toBe(',a,b')
  })

  it('accepts a backslash escape for a tab separator', async () => {
    expect(await util.apply('b\ta', { separator: '\\t' })).toBe('a\tb')
  })

  it('removes duplicates when unique is set', async () => {
    expect(await util.apply('a A b a', { unique: true })).toBe('a b')
    expect(await util.apply('a A b a', { unique: true, ignoreCase: false })).toBe('A a b')
    expect(await util.apply('a A b a', { unique: false, ignoreCase: false })).toBe('A a a b')
  })

  it('respects case when ignoreCase is false', async () => {
    expect(await util.apply('Zeta alpha', { ignoreCase: true })).toBe('alpha Zeta')
    expect(await util.apply('Zeta alpha', { ignoreCase: false })).toBe('Zeta alpha')
  })

  it('orders astral characters by code point without splitting them', async () => {
    const out = String(await util.apply('🎉 apple 🍎', { ignoreCase: false }))
    expect(out).toBe('apple 🍎 🎉')
    expect(out).not.toContain('�')
    // the default (case-insensitive) path must use the same ordering
    expect(await util.apply('🎉 apple 🍎', {})).toBe('apple 🍎 🎉')
  })

  it('keeps accented words intact', async () => {
    expect(await util.apply('über apple', { ignoreCase: false })).toBe('apple über')
  })

  it('changes only case handling — not the ordering — when ignoreCase is toggled', async () => {
    expect(await util.apply('zebra über apple', {})).toBe('apple zebra über')
    expect(await util.apply('zebra über apple', { ignoreCase: false })).toBe('apple zebra über')
    expect(await util.apply('Zebra über Apple', {})).toBe('Apple Zebra über')
  })

  it('treats the separator literally rather than as a regex', async () => {
    expect(await util.apply('b|a', { separator: '|' })).toBe('a|b')
    expect(await util.apply('b.a.c', { separator: '.' })).toBe('a.b.c')
  })

  it('returns empty string for empty input', async () => {
    expect(await util.apply('', {})).toBe('')
    expect(await util.apply('', { direction: 'desc', unique: true })).toBe('')
  })

  it('throws on an empty separator or unknown direction', () => {
    expect(() => util.apply('b a', { separator: '' } as any)).toThrow(/separator must not be empty/)
    expect(() => util.apply('b a', { direction: 'random' } as any)).toThrow(/direction must be one of/)
  })
})
