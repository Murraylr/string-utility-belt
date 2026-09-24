import { describe, it, expect } from 'vitest'
import util, { LEET_TABLES } from './index'

describe('leet', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('leet')
    expect(util.name).toBe('leet speak')
    expect(util.category).toBe('Formatting')
    expect(util.accepts).toBe('string')
    expect(util.produces).toBe('string')
    expect(Object.keys(util.params).sort()).toEqual(['direction', 'level'])
  })

  it('converts to basic leet by default', async () => {
    expect(await util.apply('Hello World', {})).toBe('H3ll0 W0rld')
    expect(await util.apply('leet speak', { level: 'basic', direction: 'to-leet' })).toBe('l337 5p34k')
  })

  it('converts to medium leet', async () => {
    expect(await util.apply('leet', { level: 'medium' })).toBe('|337')
    expect(await util.apply('big cat', { level: 'medium' })).toBe('819 <47')
  })

  it('converts to extreme leet with multi-character art', async () => {
    expect(await util.apply('wax', { level: 'extreme' })).toBe('\\^/4><')
    expect(await util.apply('mud', { level: 'extreme' })).toBe('/\\/\\\u00B5|)')
  })

  it('decodes adjacent multi-character tokens without confusing them', async () => {
    const M = '/\\/\\' // m
    const V = '\\/' // v
    const W = '\\^/' // w
    const K = '|<' // k
    const C = '<' // c
    // v sits inside m and w, and c is the tail of k: greedy longest-first
    // matching is the only thing keeping these apart
    expect(await util.apply('mvm', { level: 'extreme' })).toBe(M + V + M)
    expect(await util.apply('wvw', { level: 'extreme' })).toBe(W + V + W)
    expect(await util.apply('kc', { level: 'extreme' })).toBe(K + C)
    for (const word of ['mvm', 'wvw', 'kc', 'vvv', 'mnm']) {
      const leet = (await util.apply(word, { level: 'extreme' })) as string
      expect(await util.apply(leet, { level: 'extreme', direction: 'from-leet' }), word).toBe(word)
    }
  })

  it('round-trips every level back to lowercase letters', async () => {
    for (const level of ['basic', 'medium', 'extreme']) {
      const leet = await util.apply('the quick brown fox jumps over a lazy dog', { level })
      expect(await util.apply(leet as string, { level, direction: 'from-leet' }))
        .toBe('the quick brown fox jumps over a lazy dog')
    }
  })

  it('decodes leet written by someone else', async () => {
    expect(await util.apply('h3ll0 w0rld', { level: 'basic', direction: 'from-leet' })).toBe('hello world')
    expect(await util.apply('#4x0r', { level: 'medium', direction: 'from-leet' })).toBe('haxor')
  })

  it('leaves non-ASCII text intact and round-trips it', async () => {
    const source = '\u3053\u3093\u306B\u3061\u306F caf\u00E9 \u{1F600} test'
    const leet = await util.apply(source, { level: 'basic' })
    expect(leet).toBe('\u3053\u3093\u306B\u3061\u306F c4f\u00E9 \u{1F600} 7357')
    expect(await util.apply(leet as string, { level: 'basic', direction: 'from-leet' }))
      .toBe('\u3053\u3093\u306B\u3061\u306F caf\u00E9 \u{1F600} test')
  })

  it('keeps astral characters whole when decoding', async () => {
    const out = await util.apply('\u{1F4A9}\u{1F680}4', { level: 'extreme', direction: 'from-leet' })
    expect(out).toBe('\u{1F4A9}\u{1F680}a')
    expect(Array.from(out as string)).toHaveLength(3)
  })

  it('handles empty input in both directions', async () => {
    expect(await util.apply('', {})).toBe('')
    expect(await util.apply('', { level: 'extreme', direction: 'from-leet' })).toBe('')
  })

  it('throws on an unknown level or direction', () => {
    expect(() => util.apply('hi', { level: 'ultra' })).toThrow(/unknown leet level/)
    expect(() => util.apply('hi', { direction: 'sideways' })).toThrow(/unknown direction/)
  })

  it('uses tokens that are unique within each level', () => {
    for (const [level, table] of Object.entries(LEET_TABLES)) {
      const tokens = Object.values(table)
      expect(new Set(tokens).size, `duplicate token in ${level}`).toBe(tokens.length)
    }
  })
})
