import { describe, it, expect } from 'vitest'
import util from './index'
import escaper from '../xml_escape/index'

describe('xml_unescape', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('xml_unescape')
    expect(util.name).toBe('xml unescape')
    expect(util.category).toBe('Decoding')
    expect(util.accepts).toBe('string')
    expect(util.produces).toBe('string')
    expect(util.params).toEqual({})
  })

  it('resolves the five predefined entities', async () => {
    expect(await util.apply('&lt;a href=&quot;x&quot;&gt;Tom &amp; Jerry&apos;s&lt;/a&gt;', {}))
      .toBe('<a href="x">Tom & Jerry\'s</a>')
    expect(await util.apply('&amp;amp;', {})).toBe('&amp;')
  })

  it('returns empty string for empty input', async () => {
    expect(await util.apply('', {})).toBe('')
  })

  it('resolves decimal and hex numeric references', async () => {
    expect(await util.apply('&#65;&#x42;&#x63;', {})).toBe('ABc')
    expect(await util.apply('caf&#xE9; &#8212; &#x4E16;&#x754C;', {})).toBe('café — 世界')
  })

  it('resolves astral code points to a single character', async () => {
    expect(await util.apply('&#x1F600;', {})).toBe('\u{1F600}')
    expect(await util.apply('&#128512;', {})).toBe('\u{1F600}')
    expect(Array.from(await util.apply('&#128512;', {}) as string)).toHaveLength(1)
  })

  it('leaves everything XML does not define untouched', async () => {
    expect(await util.apply('&nbsp;&copy;', {})).toBe('&nbsp;&copy;')
    expect(await util.apply('&AMP;', {})).toBe('&AMP;')
    expect(await util.apply('a &amp b & c', {})).toBe('a &amp b & c')
    // no windows-1252 remapping here: XML numeric refs mean exactly their code point
    expect(await util.apply('&#146;', {})).toBe('\u0092')
    // a name longer than the predefined set can never match, however far away the ; is
    expect(await util.apply('&quotation;', {})).toBe('&quotation;')
    expect(await util.apply('&&&&; x', {})).toBe('&&&&; x')
  })

  it('restores whitespace references, including the carriage return xml_escape emits', async () => {
    expect(await util.apply('a&#xD;&#xA;b&#x9;c', {})).toBe('a\r\nb\tc')
    expect(await util.apply(await escaper.apply('x\r\ny', {}) as string, {})).toBe('x\r\ny')
  })

  it('throws on references XML cannot represent', async () => {
    await expect(async () => await util.apply('&#x110000;', {})).rejects.toThrow(/out of range/)
    await expect(async () => await util.apply('&#0;', {})).rejects.toThrow(/not legal in XML/)
    await expect(async () => await util.apply('&#xD800;', {})).rejects.toThrow(/not legal in XML/)
  })

  it('round-trips xml_escape output, including unicode', async () => {
    const original = 'Grüße <tag attr="v"> & \'q\' 世界 \u{1F600}'
    const escaped = await escaper.apply(original, { scope: 'non-ascii', quotes: true })
    expect(escaped)
      .toBe('Gr&#xFC;&#xDF;e &lt;tag attr=&quot;v&quot;&gt; &amp; &apos;q&apos; &#x4E16;&#x754C; &#x1F600;')
    expect(await util.apply(escaped as string, {})).toBe(original)
  })
})
