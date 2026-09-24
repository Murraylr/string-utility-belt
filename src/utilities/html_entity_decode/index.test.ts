import { describe, it, expect } from 'vitest'
import util from './index'
import encoder from '../html_entity_encode/index'

describe('html_entity_decode', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('html_entity_decode')
    expect(util.name).toBe('html entity decode')
    expect(util.category).toBe('Decoding')
    expect(util.accepts).toBe('string')
    expect(util.produces).toBe('string')
    expect(util.params).toEqual({})
  })

  it('resolves named entities', async () => {
    expect(await util.apply('&lt;p&gt;caf&eacute; &amp; cr&egrave;me&lt;/p&gt;', {}))
      .toBe('<p>café & crème</p>')
    expect(await util.apply('&copy;&nbsp;2024 &mdash; &hellip;&trade;', {}))
      .toBe('©\u00a02024 — …™')
  })

  it('returns empty string for empty input', async () => {
    expect(await util.apply('', {})).toBe('')
  })

  it('resolves decimal and hex numeric references', async () => {
    expect(await util.apply('&#72;&#105;&#x21;', {})).toBe('Hi!')
    expect(await util.apply('&#xE9;&#233;', {})).toBe('éé')
  })

  it('resolves astral code points to a single character', async () => {
    expect(await util.apply('&#128512;', {})).toBe('\u{1F600}')
    expect(await util.apply('&#x1F600;', {})).toBe('\u{1F600}')
    expect(Array.from(await util.apply('&#x1F600;', {}) as string)).toHaveLength(1)
  })

  it('accepts the legacy set without a trailing semicolon', async () => {
    expect(await util.apply('&copy 2024 &amp more', {})).toBe('© 2024 & more')
    expect(await util.apply('&copyright', {})).toBe('©right')
    expect(await util.apply('&notit;', {})).toBe('¬it;')
    expect(await util.apply('&notin;', {})).toBe('∉')
  })

  it('leaves unknown references and bare ampersands alone', async () => {
    expect(await util.apply('&bogus; & plain', {})).toBe('&bogus; & plain')
    expect(await util.apply('&hellip', {})).toBe('&hellip')
    expect(await util.apply('Tom & Jerry &#; &#x;', {})).toBe('Tom & Jerry &#; &#x;')
    // `&NBSP;` is NOT in the HTML5 table (unlike &AMP; / &COPY; / &REG; / &TRADE;)
    expect(await util.apply('&NBSP;', {})).toBe('&NBSP;')
    // only one pass: a decoded `&` must not start a second reference
    expect(await util.apply('&amp;lt;', {})).toBe('&lt;')
  })

  it('resolves the uppercase legacy aliases HTML5 actually defines', async () => {
    expect(await util.apply('&AMP;&COPY;&REG;&TRADE;&QUOT;&LT;&GT;', {})).toBe('&©®™"<>')
  })

  it('uses the HTML5 code points for &lang;, &rang; and their aliases', async () => {
    // HTML4 pointed these at U+2329/U+232A; HTML5 and every browser use U+27E8/U+27E9.
    expect(await util.apply('&lang;&rang;&langle;&rangle;', {})).toBe('⟨⟩⟨⟩')
  })

  it('applies the windows-1252 remap to C1 numeric references', async () => {
    // The classic real-world case: `&#146;` in Windows-authored markup means ’, not U+0092.
    expect(await util.apply('it&#146;s a &#147;test&#148;', {})).toBe('it’s a “test”')
    expect(await util.apply('&#128;&#x80;', {})).toBe('€€')
    expect(await util.apply('&#133;&#151;&#149;', {})).toBe('…—•')
    // the five unassigned slots pass through unchanged
    expect(await util.apply('&#129;&#141;&#143;&#144;&#157;', {}))
      .toBe('\u0081\u008d\u008f\u0090\u009d')
    // named references are never remapped
    expect(await util.apply('&fnof;', {})).toBe('ƒ')
  })

  it('agrees with a real HTML parser', async () => {
    const src =
      'AaZz09 &lt;&gt;&amp;&quot;&apos;&nbsp;&copy;&trade;&hellip;&mdash;&lang;&rang;&notin;&not;' +
      '&sup1;&frac12;&euro;&Alpha;&omega;&spades;&check;&#146;&#128;&#x1F600;&#65;&copy 2024 &notit;&ampere'
    const el = document.createElement('div')
    el.innerHTML = src
    expect(await util.apply(src, {})).toBe(el.textContent)
  })

  it('throws on out-of-range, surrogate and null references', async () => {
    await expect(async () => await util.apply('&#x110000;', {})).rejects.toThrow(/out of range/)
    await expect(async () => await util.apply('&#99999999999;', {})).rejects.toThrow(/out of range/)
    await expect(async () => await util.apply('&#xD800;', {})).rejects.toThrow(/lone surrogate/)
    await expect(async () => await util.apply('&#0;', {})).rejects.toThrow(/null character/)
  })

  it('round-trips every Latin-1 named entity', async () => {
    const latin1 = Array.from({ length: 96 }, (_, i) => String.fromCodePoint(160 + i)).join('')
    const encoded = await encoder.apply(latin1, { mode: 'named', scope: 'non-ascii' })
    expect(encoded).toContain('&nbsp;')
    // every Latin-1 character has a name, so nothing should fall back to a number
    expect(encoded).not.toMatch(/&#/)
    expect(await util.apply(encoded as string, {})).toBe(latin1)
  })

  it('round-trips html_entity_encode output, including unicode', async () => {
    const original = 'Grüße, 世界 <b>&</b> "x" 😀'
    const encoded = await encoder.apply(original, { mode: 'named', scope: 'non-ascii' })
    expect(encoded).toBe('Gr&uuml;&szlig;e, &#19990;&#30028; &lt;b&gt;&amp;&lt;/b&gt; &quot;x&quot; &#128512;')
    expect(await util.apply(encoded as string, {})).toBe(original)
    const hex = await encoder.apply(original, { mode: 'hex', scope: 'all' })
    expect(await util.apply(hex as string, {})).toBe(original)
  })
})
