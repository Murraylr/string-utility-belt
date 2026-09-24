import { describe, it, expect } from 'vitest'
import util from './index'
import decoder from '../punycode_decode'

describe('punycode_encode', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('punycode_encode')
    expect(util.name).toBe('punycode encode')
    expect(util.category).toBe('Encoding')
    expect(util.accepts).toBe('string')
    expect(util.produces).toBe('string')
    expect(util.params.mode).toMatchObject({ kind: 'select', default: 'domain' })
  })

  it('encodes a domain label by label (default mode)', async () => {
    expect(await util.apply('münchen.de', {})).toBe('xn--mnchen-3ya.de')
    expect(await util.apply('bücher.example.com', { mode: 'domain' })).toBe('xn--bcher-kva.example.com')
    expect(await util.apply('例え.テスト', { mode: 'domain' })).toBe('xn--r8jz45g.xn--zckzah')
  })

  it('leaves pure-ASCII labels untouched in domain mode', async () => {
    expect(await util.apply('example.com', { mode: 'domain' })).toBe('example.com')
    expect(await util.apply('xn--bcher-kva.example.com', { mode: 'domain' })).toBe('xn--bcher-kva.example.com')
  })

  it('returns empty string for empty input', async () => {
    expect(await util.apply('', {})).toBe('')
    expect(await util.apply('', { mode: 'raw' })).toBe('')
    expect(await util.apply('', { mode: 'label' })).toBe('')
  })

  it('treats the whole input as one label in label mode', async () => {
    expect(await util.apply('münchen', { mode: 'label' })).toBe('xn--mnchen-3ya')
    // dots are not label separators here
    expect(await util.apply('ü.ü', { mode: 'label' })).toBe('xn--.-dhab')
    expect(await util.apply('plain-text', { mode: 'label' })).toBe('plain-text')
  })

  it('emits bare RFC 3492 bootstring output in raw mode', async () => {
    expect(await util.apply('bücher', { mode: 'raw' })).toBe('bcher-kva')
    expect(await util.apply('日本語', { mode: 'raw' })).toBe('wgv71a119e')
    // RFC 3492 sample (L): Japanese with an ASCII prefix
    expect(await util.apply('3年B組金八先生', { mode: 'raw' })).toBe('3B-ww4c5e180e575a65lsy2b')
    // pure ASCII still gets the bootstring delimiter
    expect(await util.apply('abc', { mode: 'raw' })).toBe('abc-')
  })

  it('matches the RFC 3492 Arabic and Chinese samples', async () => {
    expect(await util.apply('ليهمابتكلموشعربي؟', { mode: 'raw' })).toBe('egbpdaj6bu4bxfgehfvwxn')
    expect(await util.apply('他们为什么不说中文', { mode: 'raw' })).toBe('ihqwcrb4cv8a8dqg056pqjye')
  })

  it('handles astral-plane characters without splitting surrogates', async () => {
    expect(await util.apply('😀', { mode: 'raw' })).toBe('e28h')
    // matches WHATWG URL IDNA: new URL('http://😀.com').hostname
    expect(await util.apply('😀.com', { mode: 'domain' })).toBe('xn--e28h.com')
  })

  it('refuses unpaired surrogates instead of emitting undecodable punycode', () => {
    // A lone high surrogate would encode to "8c9b", which punycode_decode
    // (correctly) rejects as an invalid code point — so the encoder must refuse.
    expect(() => util.apply('\ud83d', { mode: 'raw' })).toThrow(/unpaired surrogate U\+D83D/)
    expect(() => util.apply('a\udc00b', { mode: 'label' })).toThrow(/unpaired surrogate U\+DC00/)
    expect(() => util.apply('\ud83d.com', { mode: 'domain' })).toThrow(/unpaired surrogate/)
    // a properly paired surrogate is one code point and encodes fine
    expect(util.apply('😀', { mode: 'raw' })).toBe('e28h')
  })

  it('throws on a label that is already xn-- prefixed but still holds non-ASCII', () => {
    expect(() => util.apply('xn--bücher.com', { mode: 'domain' })).toThrow(/xn--/)
    expect(() => util.apply('xn--münchen', { mode: 'label' })).toThrow(/already/)
  })

  it('round-trips through punycode_decode', async () => {
    const cases = ['münchen.de', '例え.テスト', 'россия.рф', 'bücher.example.com', '😀.com']
    for (const value of cases) {
      const encoded = (await util.apply(value, { mode: 'domain' })) as string
      expect(await decoder.apply(encoded, { mode: 'domain' })).toBe(value)
    }
    const raw = (await util.apply('Pročprostěnemluvíčesky', { mode: 'raw' })) as string
    expect(raw).toBe('Proprostnemluvesky-uyb24dma41a')
    expect(await decoder.apply(raw, { mode: 'raw' })).toBe('Pročprostěnemluvíčesky')
    const label = (await util.apply('🎉party', { mode: 'label' })) as string
    expect(await decoder.apply(label, { mode: 'label' })).toBe('🎉party')
  })
})
