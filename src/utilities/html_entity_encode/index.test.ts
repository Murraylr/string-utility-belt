import { describe, it, expect } from 'vitest'
import util from './index'
import decoder from '../html_entity_decode/index'

describe('html_entity_encode', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('html_entity_encode')
    expect(util.name).toBe('html entity encode')
    expect(util.category).toBe('Encoding')
    expect(util.accepts).toBe('string')
    expect(util.produces).toBe('string')
    expect(Object.keys(util.params).sort()).toEqual(['mode', 'scope'])
  })

  it('escapes markup and non-ASCII with the defaults', async () => {
    expect(await util.apply('Café & <b>', {})).toBe('Caf&eacute; &amp; &lt;b&gt;')
    expect(await util.apply('a\u00a0b', {})).toBe('a&nbsp;b')
  })

  it('returns empty string for empty input', async () => {
    expect(await util.apply('', {})).toBe('')
    expect(await util.apply('', { mode: 'hex', scope: 'all' })).toBe('')
  })

  it('uses a wide named table before falling back to numbers', async () => {
    expect(await util.apply('©™→π', { mode: 'named', scope: 'non-ascii' }))
      .toBe('&copy;&trade;&rarr;&pi;')
    expect(await util.apply('…—½', { mode: 'named', scope: 'non-ascii' }))
      .toBe('&hellip;&mdash;&frac12;')
  })

  it('carries a named table of at least 250 entities', async () => {
    let bmp = ''
    for (let cp = 0x20; cp <= 0xffff; cp++) {
      if (cp >= 0xd800 && cp <= 0xdfff) continue
      bmp += String.fromCodePoint(cp)
    }
    const encoded = await util.apply(bmp, { mode: 'named', scope: 'all' }) as string
    const names = new Set(encoded.match(/&[a-zA-Z][a-zA-Z0-9]*;/g) ?? [])
    expect(names.size).toBeGreaterThanOrEqual(250)
  })

  it('uses the HTML5 code points for &lang; and &rang;', async () => {
    // HTML4 pointed these at U+2329/U+232A; HTML5 and every browser use U+27E8/U+27E9.
    expect(await util.apply('⟨x⟩', {})).toBe('&lang;x&rang;')
    // ...so the deprecated CJK brackets must fall back to a numeric reference.
    expect(await util.apply('〈〉', {})).toBe('&#9001;&#9002;')
  })

  it('never emits a numeric reference an HTML parser would rewrite', async () => {
    // `&#128;` reads back as U+20AC and `&#0;` as U+FFFD, so those code points
    // can only be carried through as literal characters.
    expect(await util.apply('\u0080\u0092\u009f', { mode: 'decimal', scope: 'all' }))
      .toBe('\u0080\u0092\u009f')
    expect(await util.apply('\u0000', { mode: 'hex', scope: 'all' })).toBe('\u0000')
    expect(await util.apply('\u007f', { mode: 'decimal', scope: 'all' })).toBe('&#127;')
  })

  it('produces output a real HTML parser reads back as the input', async () => {
    let sample = ''
    for (let cp = 0x20; cp <= 0xfffd; cp++) {
      if (cp >= 0xd800 && cp <= 0xdfff) continue
      sample += String.fromCodePoint(cp)
    }
    sample += '\u{1F600}\u{1F44D}\u{10FFFF}'
    const el = document.createElement('div')
    for (const mode of ['named', 'decimal', 'hex']) {
      for (const scope of ['minimal', 'non-ascii', 'all']) {
        el.innerHTML = await util.apply(sample, { mode, scope }) as string
        expect(el.textContent).toBe(sample)
      }
    }
  })

  it('scope minimal only touches the five markup characters', async () => {
    expect(await util.apply('Café & "x"', { scope: 'minimal' })).toBe('Café &amp; &quot;x&quot;')
    expect(await util.apply("it's", { scope: 'minimal' })).toBe('it&apos;s')
  })

  it('scope all encodes every character', async () => {
    expect(await util.apply('hi', { mode: 'decimal', scope: 'all' })).toBe('&#104;&#105;')
    expect(await util.apply('a<', { mode: 'named', scope: 'all' })).toBe('&#97;&lt;')
    expect(await util.apply('hi', { mode: 'hex', scope: 'all' })).toBe('&#x68;&#x69;')
  })

  it('emits decimal and hex references on demand', async () => {
    expect(await util.apply('é', { mode: 'decimal' })).toBe('&#233;')
    expect(await util.apply('é', { mode: 'hex' })).toBe('&#xE9;')
    expect(await util.apply('&', { mode: 'hex', scope: 'minimal' })).toBe('&#x26;')
  })

  it('keeps astral characters whole and falls back to one numeric reference', async () => {
    expect(await util.apply('\u{1F600}', {})).toBe('&#128512;')
    expect(await util.apply('\u{1F600}', { mode: 'hex' })).toBe('&#x1F600;')
    expect(await util.apply('\u{1F44D}\u{1F3FD}', { mode: 'decimal' })).toBe('&#128077;&#127997;')
  })

  it('throws on an unknown mode or scope', async () => {
    await expect(async () => await util.apply('x', { mode: 'rot13' })).rejects.toThrow(/unknown mode/)
    await expect(async () => await util.apply('x', { scope: 'everything' })).rejects.toThrow(/unknown scope/)
  })

  it('round-trips through html_entity_decode, including unicode', async () => {
    const original = 'Héllo <世界> & "quotes" \'apos\' \u{1F600} — ©'
    for (const mode of ['named', 'decimal', 'hex']) {
      for (const scope of ['minimal', 'non-ascii', 'all']) {
        const encoded = await util.apply(original, { mode, scope })
        expect(await decoder.apply(encoded as string, {})).toBe(original)
      }
    }
  })
})
