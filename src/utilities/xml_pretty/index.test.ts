import { describe, it, expect } from 'vitest'
import util from './index'

describe('xml_pretty', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('xml_pretty')
    expect(util.name).toBe('xml pretty')
    expect(util.category).toBe('Formatting')
    expect(util.accepts).toBe('string')
    expect(util.produces).toBe('string')
    expect(Object.keys(util.params).sort()).toEqual(['collapseEmpty', 'indent'].sort())
  })

  it('reindents a minified document', async () => {
    const src =
      '<?xml version="1.0"?><catalog id="1"><book><title>XML</title><author>Ada</author></book><book><title>JS</title></book></catalog>'
    expect(await util.apply(src, {})).toBe(
      '<?xml version="1.0"?>\n' +
        '<catalog id="1">\n' +
        '  <book>\n' +
        '    <title>XML</title>\n' +
        '    <author>Ada</author>\n' +
        '  </book>\n' +
        '  <book>\n' +
        '    <title>JS</title>\n' +
        '  </book>\n' +
        '</catalog>'
    )
  })

  it('is idempotent on already formatted xml', async () => {
    const pretty = '<a>\n  <b>1</b>\n  <c>\n    <d>2</d>\n  </c>\n</a>'
    expect(await util.apply(pretty, {})).toBe(pretty)
  })

  it('returns empty string for empty input', async () => {
    expect(await util.apply('', {})).toBe('')
    expect(await util.apply('   \n\t ', {})).toBe('')
  })

  it('honours the indent param, including 0', async () => {
    expect(await util.apply('<a><b>c</b></a>', { indent: 4 })).toBe('<a>\n    <b>c</b>\n</a>')
    expect(await util.apply('<a><b>c</b></a>', { indent: 0 })).toBe('<a>\n<b>c</b>\n</a>')
  })

  it('honours collapseEmpty in both directions', async () => {
    expect(await util.apply('<a><b></b><c/></a>', { collapseEmpty: true })).toBe(
      '<a>\n  <b/>\n  <c/>\n</a>'
    )
    expect(await util.apply('<a><b></b><c/></a>', { collapseEmpty: false })).toBe(
      '<a>\n  <b></b>\n  <c></c>\n</a>'
    )
    expect(await util.apply('<a>\n\n  </a>', { collapseEmpty: true })).toBe('<a/>')
  })

  it('keeps comments, CDATA and the doctype intact', async () => {
    const src =
      '<!DOCTYPE root SYSTEM "r.dtd"><root><!-- a comment --><data><![CDATA[<b> & </b>]]></data></root>'
    expect(await util.apply(src, {})).toBe(
      '<!DOCTYPE root SYSTEM "r.dtd">\n' +
        '<root>\n' +
        '  <!-- a comment -->\n' +
        '  <data><![CDATA[<b> & </b>]]></data>\n' +
        '</root>'
    )
  })

  it('keeps mixed content on one line instead of reflowing words', async () => {
    expect(await util.apply('<p>\n  Hello <b>brave</b> world\n</p>', {})).toBe(
      '<p>Hello <b>brave</b> world</p>'
    )
  })

  it('never pushes CDATA onto its own line, since that would edit its content', async () => {
    // CDATA is character data: indenting it around siblings changes the value
    const src = '<a><b>1</b><![CDATA[x]]></a>'
    expect(await util.apply(src, {})).toBe(src)
    expect(await util.apply((await util.apply(src, {})) as string, {})).toBe(src)
  })

  it('normalizes attributes spread over several lines', async () => {
    expect(await util.apply('<a  x = "1"\n     y=\'two words\'>t</a>', {})).toBe(
      '<a x="1" y=\'two words\'>t</a>'
    )
  })

  it('preserves unicode names, attributes and astral text', async () => {
    const out = await util.apply('<грüß emoji="😀"><жди>Καλημέρα 😀</жди></грüß>', {})
    expect(out).toBe('<грüß emoji="😀">\n  <жди>Καλημέρα 😀</жди>\n</грüß>')
    expect(Array.from(out as string).filter((c) => c === '😀').length).toBe(2)
  })

  it('throws on malformed xml', async () => {
    expect(() => util.apply('<a><b></a>', {})).toThrow(/malformed XML/)
    expect(() => util.apply('<a>', {})).toThrow(/never closed/)
    expect(() => util.apply('</a>', {})).toThrow(/no matching opening tag/)
    expect(() => util.apply('<a', {})).toThrow(/unterminated tag/)
    expect(() => util.apply('<a><!-- oops</a>', {})).toThrow(/unterminated comment/)
  })
})

describe('xml_pretty — attacker-sized input', () => {
  // text flattening used /[ \t]*\r?\n[ \t]*/g, quadratic on a long space run with no
  // newline; tag trimming used /\s+$/, quadratic on a long space run inside a tag
  it('formats text holding a huge run of spaces in linear time', () => {
    const t0 = performance.now()
    const out = util.apply('<a>' + ' '.repeat(200_000) + 'x</a>', {}) as string
    expect(performance.now() - t0).toBeLessThan(1500)
    expect(out).toContain('x')
  })

  it('formats a tag holding a huge run of spaces in linear time', () => {
    const t0 = performance.now()
    util.apply('<a b="1"' + ' '.repeat(200_000) + 'c="2"/>', {})
    expect(performance.now() - t0).toBeLessThan(1500)
  })

  it('still joins wrapped text lines with one space each', () => {
    expect(util.apply('<p>one  \n  two\r\n\tthree\n \nfour</p>', {})).toContain('one two three  four')
  })
})
