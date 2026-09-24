import { describe, it, expect } from 'vitest'
import util, { expandAlphabet } from './index'

/** A lone surrogate half in either direction — always broken output. */
const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/

describe('nanoid', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('nanoid')
    expect(util.name).toBe('nanoid')
    expect(util.category).toBe('Generators')
    expect(util.accepts).toBe('string')
    expect(util.produces).toBe('string')
  })

  it('generates a 21-character url-safe id by default', async () => {
    const out = String(await util.apply('', {}))
    expect(out).toHaveLength(21)
    expect(out).toMatch(/^[A-Za-z0-9_-]{21}$/)
    expect(String(await util.apply('', {}))).not.toBe(out)
  })

  it('honours the size option', async () => {
    expect(String(await util.apply('', { size: 8 }))).toHaveLength(8)
    expect(String(await util.apply('', { size: 64 }))).toHaveLength(64)
    expect(String(await util.apply('', { size: 4096 }))).toHaveLength(4096)
    expect(await util.apply('', { size: 0 })).toBe('')
  })

  it('expands a-z ranges in the alphabet exactly like the literal set', async () => {
    expect(expandAlphabet('a-c').join('')).toBe('abc')
    expect(expandAlphabet('A-Za-z0-9_-').join('')).toBe(
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-'
    )
    expect(expandAlphabet('A-Za-z0-9_-')).toHaveLength(64)
    expect(expandAlphabet('-abc-').join('')).toBe('-abc-')
    expect(await util.apply('', { seed: 42, size: 10, alphabet: 'a-c' }))
      .toBe(await util.apply('', { seed: 42, size: 10, alphabet: 'abc' }))
  })

  it('restricts output to a custom alphabet and uses all of it', async () => {
    const out = String(await util.apply('', { size: 40, alphabet: 'abc' }))
    expect(out).toMatch(/^[abc]{40}$/)
    expect(String(await util.apply('', { size: 5, alphabet: 'x' }))).toBe('xxxxx')
    // every character of the default alphabet is reachable
    expect(new Set(String(await util.apply('', { size: 4000 }))).size).toBe(64)
  })

  it('keeps astral characters whole in a unicode alphabet', async () => {
    const out = String(await util.apply('', { size: 12, alphabet: '🙂🙃🎉' }))
    const points = Array.from(out)
    expect(points).toHaveLength(12)
    expect(points.every(c => '🙂🙃🎉'.includes(c))).toBe(true)
    expect(out).not.toMatch(LONE_SURROGATE)
    expect(expandAlphabet('🙂-🙄')).toEqual(['🙂', '🙃', '🙄'])
  })

  it('never emits a lone surrogate from a range that spans U+D800', async () => {
    // '\u0000-\uFFFF' covers the surrogate block; emitting those code points on
    // their own would produce broken, unpaired UTF-16 halves.
    const expanded = expandAlphabet('\u0000-\uFFFF')
    expect(expanded).toHaveLength(0x10000 - 0x800)
    expect(expanded.some(c => c.codePointAt(0)! >= 0xd800 && c.codePointAt(0)! <= 0xdfff)).toBe(false)
    const out = String(await util.apply('', { size: 500, alphabet: '\u0000-\uFFFF' }))
    expect(out).not.toMatch(LONE_SURROGATE)
    expect(Array.from(out)).toHaveLength(500)
    // a bare surrogate written literally is dropped rather than passed through
    expect(expandAlphabet('a\uD800b')).toEqual(['a', 'b'])
  })

  it('generates count ids, one per line', async () => {
    const lines = String(await util.apply('', { count: 4 })).split('\n')
    expect(lines).toHaveLength(4)
    expect(new Set(lines).size).toBe(4)
    const seeded = String(await util.apply('', { count: 4, seed: 5 })).split('\n')
    expect(new Set(seeded).size).toBe(4)
  })

  it('is reproducible with a non-zero seed', async () => {
    expect(await util.apply('', { seed: 42 })).toBe('8KAtKTUBeB5T10-Gi1JGc')
    expect(await util.apply('', { seed: 42, size: 10, alphabet: 'abc' })).toBe('abacaabcaa')
    expect(await util.apply('', { seed: 123, size: 16, alphabet: '0-9a-f' })).toBe('87ef12f2df7b2dcd')
    expect(await util.apply('', { seed: 43 })).not.toBe(await util.apply('', { seed: 42 }))
    expect(await util.apply('', { seed: -7 })).toBe(await util.apply('', { seed: -7 }))
  })

  it('ignores its input, including unicode', async () => {
    expect(String(await util.apply('🙂 café', {}))).toMatch(/^[A-Za-z0-9_-]{21}$/)
    expect(String(await util.apply('', {}))).toMatch(/^[A-Za-z0-9_-]{21}$/)
  })

  it('throws on an empty alphabet, a bad range or an out-of-range size/count', () => {
    expect(() => util.apply('', { alphabet: '' })).toThrow(/alphabet must contain at least one character/)
    expect(() => util.apply('', { alphabet: '\uD800' })).toThrow(/alphabet must contain at least one character/)
    expect(() => util.apply('', { alphabet: 'z-a' })).toThrow(/invalid character range/)
    expect(() => util.apply('', { size: -1 })).toThrow(/size must be 0 or more/)
    expect(() => util.apply('', { size: 5000 })).toThrow(/size must be 4096 or less/)
    expect(() => util.apply('', { count: 0 })).toThrow(/count must be at least 1/)
    expect(() => util.apply('', { count: 10001 })).toThrow(/count must be 10000 or less/)
    expect(() => util.apply('', { size: 4000, count: 500 })).toThrow(/size x count must be 1000000 or less/)
  })
})
