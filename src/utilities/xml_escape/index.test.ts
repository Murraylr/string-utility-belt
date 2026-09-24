import { describe, it, expect } from 'vitest'
import util from './index'
import unescaper from '../xml_unescape/index'

describe('xml_escape', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('xml_escape')
    expect(util.name).toBe('xml escape')
    expect(util.category).toBe('Encoding')
    expect(util.accepts).toBe('string')
    expect(util.produces).toBe('string')
    expect(Object.keys(util.params).sort()).toEqual(['quotes', 'scope'])
  })

  it('escapes the five predefined entities by default', async () => {
    expect(await util.apply('<a href="x">Tom & Jerry\'s</a>', {}))
      .toBe('&lt;a href=&quot;x&quot;&gt;Tom &amp; Jerry&apos;s&lt;/a&gt;')
    expect(await util.apply('a]]>b', {})).toBe('a]]&gt;b')
  })

  it('returns empty string for empty input', async () => {
    expect(await util.apply('', {})).toBe('')
    expect(await util.apply('', { quotes: false, scope: 'non-ascii' })).toBe('')
  })

  it('leaves quotes alone when quotes is false', async () => {
    expect(await util.apply('He said "hi" & it\'s <ok>', { quotes: false }))
      .toBe('He said "hi" &amp; it\'s &lt;ok&gt;')
    expect(await util.apply('"\'', { quotes: true })).toBe('&quot;&apos;')
  })

  it('keeps unicode intact in minimal scope and escapes it in non-ascii scope', async () => {
    expect(await util.apply('café — 世界', { scope: 'minimal' })).toBe('café — 世界')
    expect(await util.apply('café', { scope: 'non-ascii' })).toBe('caf&#xE9;')
    expect(await util.apply('世界', { scope: 'non-ascii' })).toBe('&#x4E16;&#x754C;')
  })

  it('escapes astral characters as a single reference', async () => {
    expect(await util.apply('\u{1F600}', { scope: 'non-ascii' })).toBe('&#x1F600;')
    expect(await util.apply('\u{1F600}', { scope: 'minimal' })).toBe('\u{1F600}')
  })

  it('keeps tab and newline literal but escapes carriage return', async () => {
    // XML 1.0 §2.11 makes parsers normalise a literal CR (and CRLF) to a single
    // LF, so a bare \r has to become &#xD; or it is silently lost on the next parse.
    expect(await util.apply('a\tb\nc\r\nd', { scope: 'non-ascii' })).toBe('a\tb\nc&#xD;\nd')
    expect(await util.apply('\r', { scope: 'minimal' })).toBe('&#xD;')
    expect(await unescaper.apply(await util.apply('a\r\nb', {}) as string, {})).toBe('a\r\nb')
  })

  it('survives a real XML parser byte for byte', async () => {
    const sample = 'Grüße <tag a="1" b=\'2\'> & 世界 \u{1F600} ]]> \t\n\r end'
    for (const scope of ['minimal', 'non-ascii']) {
      const escaped = await util.apply(sample, { scope }) as string
      const doc = new DOMParser().parseFromString(`<r>${escaped}</r>`, 'text/xml')
      expect(doc.getElementsByTagName('parsererror')).toHaveLength(0)
      expect(doc.documentElement.textContent).toBe(sample)
    }
  })

  it('throws on characters XML 1.0 cannot represent, and on an unknown scope', async () => {
    await expect(async () => await util.apply('a\u0000b', {})).rejects.toThrow(/U\+0000/)
    await expect(async () => await util.apply('a\u0008b', {})).rejects.toThrow(/not a legal XML/)
    await expect(async () => await util.apply('x', { scope: 'all' })).rejects.toThrow(/unknown scope/)
  })

  it('round-trips through xml_unescape, including unicode', async () => {
    const original = 'Grüße <tag attr="v"> & \'q\' 世界 \u{1F600} \r\n\t]]>'
    for (const scope of ['minimal', 'non-ascii']) {
      for (const quotes of [true, false]) {
        const escaped = await util.apply(original, { scope, quotes })
        expect(await unescaper.apply(escaped as string, {})).toBe(original)
      }
    }
  })
})
