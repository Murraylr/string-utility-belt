import { describe, it, expect } from 'vitest'
import util from './index'

describe('reverse_words', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('reverse_words')
    expect(util.name).toBe('reverse word order')
    expect(util.category).toBe('String Ops')
    expect(util.accepts).toBe('string')
    expect(util.produces).toBe('string')
    expect(Object.keys(util.params)).toEqual(['separator', 'perLine'])
  })

  it('reverses the words of a sentence', async () => {
    expect(await util.apply('the quick brown fox', {})).toBe('fox brown quick the')
    expect(await util.apply('one', {})).toBe('one')
  })

  it('returns empty string for empty input', async () => {
    expect(await util.apply('', {})).toBe('')
    expect(await util.apply('', { separator: ',', perLine: false })).toBe('')
  })

  it('reverses each line independently when perLine is on', async () => {
    expect(await util.apply('a b\nc d', { perLine: true })).toBe('b a\nd c')
    expect(await util.apply('one two three\nfour five', { perLine: true }))
      .toBe('three two one\nfive four')
  })

  it('reverses across the whole text when perLine is off', async () => {
    expect(await util.apply('a b\nc d', { perLine: false })).toBe('d b\nc a')
  })

  it('splits on a custom separator', async () => {
    expect(await util.apply('a,b,c', { separator: ',' })).toBe('c,b,a')
    expect(await util.apply('one::two::three', { separator: '::' })).toBe('three::two::one')
  })

  it('understands backslash escapes in the separator', async () => {
    expect(await util.apply('a\tb\tc', { separator: '\\t' })).toBe('c\tb\ta')
    expect(await util.apply('a\nb', { separator: '\\n', perLine: false })).toBe('b\na')
  })

  it('keeps astral characters intact', async () => {
    expect(await util.apply('😀 🎉 ✅', {})).toBe('✅ 🎉 😀')
    expect(await util.apply('héllo wörld 𝒜', {})).toBe('𝒜 wörld héllo')
  })

  it('preserves CRLF line endings', async () => {
    expect(await util.apply('a b\r\nc d', { perLine: true })).toBe('b a\r\nd c')
  })

  it('is its own inverse', async () => {
    const source = 'alpha beta gamma delta'
    const once = await util.apply(source, {})
    expect(once).toBe('delta gamma beta alpha')
    expect(await util.apply(once as string, {})).toBe(source)
  })

  it('leaves separators that do not occur alone', async () => {
    expect(await util.apply('no-separators-here', { separator: ' ' })).toBe('no-separators-here')
    expect(await util.apply('a b c', { separator: ',' })).toBe('a b c')
  })

  it('throws when the separator is empty', () => {
    expect(() => util.apply('a b c', { separator: '' })).toThrow(/separator/)
  })
})
