import { describe, it, expect } from 'vitest'
import util from './index'
import encoder from '../punycode_encode'

describe('punycode_decode', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('punycode_decode')
    expect(util.name).toBe('punycode decode')
    expect(util.category).toBe('Decoding')
    expect(util.accepts).toBe('string')
    expect(util.produces).toBe('string')
    expect(util.params.mode).toMatchObject({ kind: 'select', default: 'domain' })
  })

  it('decodes xn-- labels in a domain (default mode)', async () => {
    expect(await util.apply('xn--mnchen-3ya.de', {})).toBe('münchen.de')
    expect(await util.apply('xn--r8jz45g.xn--zckzah', { mode: 'domain' })).toBe('例え.テスト')
    expect(await util.apply('xn--h1alffa9f.xn--p1ai', { mode: 'domain' })).toBe('россия.рф')
  })

  it('leaves labels without an xn-- prefix untouched', async () => {
    expect(await util.apply('example.com', { mode: 'domain' })).toBe('example.com')
    expect(await util.apply('xn--bcher-kva.example.com', { mode: 'domain' })).toBe('bücher.example.com')
  })

  it('returns empty string for empty input', async () => {
    expect(await util.apply('', {})).toBe('')
    expect(await util.apply('', { mode: 'raw' })).toBe('')
    expect(await util.apply('', { mode: 'label' })).toBe('')
  })

  it('decodes a single label in label mode', async () => {
    expect(await util.apply('xn--mnchen-3ya', { mode: 'label' })).toBe('münchen')
    // the xn-- prefix is matched case-insensitively; the literal portion keeps its case
    expect(await util.apply('XN--mnchen-3ya', { mode: 'label' })).toBe('münchen')
    expect(await util.apply('xn--MNCHEN-3ya', { mode: 'label' })).toBe('MüNCHEN')
    expect(await util.apply('plain-text', { mode: 'label' })).toBe('plain-text')
  })

  it('decodes bare bootstring text in raw mode', async () => {
    expect(await util.apply('bcher-kva', { mode: 'raw' })).toBe('bücher')
    expect(await util.apply('wgv71a119e', { mode: 'raw' })).toBe('日本語')
    expect(await util.apply('egbpdaj6bu4bxfgehfvwxn', { mode: 'raw' })).toBe('ليهمابتكلموشعربي؟')
    // a trailing delimiter marks an all-ASCII payload
    expect(await util.apply('abc-', { mode: 'raw' })).toBe('abc')
  })

  it('rebuilds astral-plane characters as whole code points', async () => {
    const emoji = (await util.apply('e28h', { mode: 'raw' })) as string
    expect(emoji).toBe('😀')
    expect(Array.from(emoji)).toHaveLength(1)
    expect(await util.apply('xn--e28h.com', { mode: 'domain' })).toBe('😀.com')
  })

  it('throws a clear error on malformed punycode', () => {
    expect(() => util.apply('abc-!', { mode: 'raw' })).toThrow(/invalid digit/)
    expect(() => util.apply('xn--abc-!', { mode: 'label' })).toThrow(/invalid digit/)
    expect(() => util.apply('müller-x', { mode: 'raw' })).toThrow(/non-ASCII/)
    expect(() => util.apply('zzzzzzzzzzz', { mode: 'raw' })).toThrow(/truncated/)
    // "8c9b" is the bootstring for the lone high surrogate U+D83D (55357)
    expect(() => util.apply('8c9b', { mode: 'raw' })).toThrow(/invalid code point \(55357\)/)
    // 11 nines overflows the RFC's 32-bit integer budget
    expect(() => util.apply('99999999999', { mode: 'raw' })).toThrow(/overflow/)
  })

  it('round-trips back through punycode_encode', async () => {
    const cases = ['xn--mnchen-3ya.de', 'xn--r8jz45g.xn--zckzah', 'xn--e28h.com', 'example.com']
    for (const value of cases) {
      const decoded = (await util.apply(value, { mode: 'domain' })) as string
      expect(await encoder.apply(decoded, { mode: 'domain' })).toBe(value)
    }
    const raw = (await util.apply('3B-ww4c5e180e575a65lsy2b', { mode: 'raw' })) as string
    expect(raw).toBe('3年B組金八先生')
    expect(await encoder.apply(raw, { mode: 'raw' })).toBe('3B-ww4c5e180e575a65lsy2b')
  })
})
