import { describe, it, expect } from 'vitest'
import util from './index'

const PRETTY = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<catalog id="1">',
  '  <!-- the first book -->',
  '  <book>',
  '    <title>XML</title>',
  '    <tags/>',
  '  </book>',
  '</catalog>'
].join('\n')

describe('xml_minify', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('xml_minify')
    expect(util.name).toBe('xml minify')
    expect(util.category).toBe('Formatting')
    expect(util.accepts).toBe('string')
    expect(util.produces).toBe('string')
    expect(Object.keys(util.params)).toEqual(['removeComments'])
  })

  it('strips inter-tag whitespace and comments by default', async () => {
    expect(await util.apply(PRETTY, {})).toBe(
      '<?xml version="1.0" encoding="UTF-8"?><catalog id="1"><book><title>XML</title><tags/></book></catalog>'
    )
  })

  it('keeps comments when removeComments is false', async () => {
    expect(await util.apply(PRETTY, { removeComments: false })).toBe(
      '<?xml version="1.0" encoding="UTF-8"?><catalog id="1"><!-- the first book --><book><title>XML</title><tags/></book></catalog>'
    )
  })

  it('returns empty string for empty input', async () => {
    expect(await util.apply('', {})).toBe('')
    expect(await util.apply('  \n ', {})).toBe('')
  })

  it('strips indentation around text but keeps spacing inside a line', async () => {
    expect(await util.apply('<desc>\n    Some long text\n  </desc>', {})).toBe(
      '<desc>Some long text</desc>'
    )
    expect(await util.apply('<p>Hello <b>brave</b> world</p>', {})).toBe(
      '<p>Hello <b>brave</b> world</p>'
    )
  })

  it('keeps the word separator when a line break sits next to a sibling element', async () => {
    // the break between "Hello" and <b> separates words; deleting it would
    // silently glue them into "Hellox"
    expect(await util.apply('<p>Hello\n<b>x</b>\nworld</p>', {})).toBe('<p>Hello <b>x</b> world</p>')
    expect(await util.apply('<p>a\r\n<b>x</b>\r\nb</p>', {})).toBe('<p>a <b>x</b> b</p>')
    expect(await util.apply('<a>\n  <b>1</b>\n  tail\n</a>', {})).toBe('<a><b>1</b> tail</a>')
    const once = (await util.apply('<p>Hello\n<b>x</b>\nworld</p>', {})) as string
    expect(await util.apply(once, {})).toBe(once)
  })

  it('copies CDATA, processing instructions and the doctype verbatim', async () => {
    const src = '<!DOCTYPE root SYSTEM "r.dtd">\n<root>\n  <d><![CDATA[  <b> & </b>  ]]></d>\n</root>'
    expect(await util.apply(src, {})).toBe(
      '<!DOCTYPE root SYSTEM "r.dtd"><root><d><![CDATA[  <b> & </b>  ]]></d></root>'
    )
  })

  it('collapses attributes spread over several lines', async () => {
    expect(await util.apply('<a  x = "1"\n     y=\'two words\'>t</a>', {})).toBe(
      '<a x="1" y=\'two words\'>t</a>'
    )
  })

  it('preserves unicode names, attributes and astral text', async () => {
    const out = await util.apply('<грüß emoji="😀">\n  <жди>Καλημέρα 😀</жди>\n</грüß>', {})
    expect(out).toBe('<грüß emoji="😀"><жди>Καλημέρα 😀</жди></грüß>')
    expect(Array.from(out as string).filter((c) => c === '😀').length).toBe(2)
  })

  it('is idempotent', async () => {
    const once = (await util.apply(PRETTY, {})) as string
    expect(await util.apply(once, {})).toBe(once)
  })

  it('throws on malformed xml', async () => {
    expect(() => util.apply('<a><b></a>', {})).toThrow(/malformed XML/)
    expect(() => util.apply('<a>', {})).toThrow(/never closed/)
    expect(() => util.apply('</a>', {})).toThrow(/no matching opening tag/)
    expect(() => util.apply('<a><![CDATA[oops</a>', {})).toThrow(/unterminated CDATA/)
  })
})

describe('xml_minify — attacker-sized input', () => {
  it('minifies text holding a huge run of spaces in linear time', () => {
    const t0 = performance.now()
    const out = util.apply('<a>' + ' '.repeat(200_000) + 'x</a>', {}) as string
    expect(performance.now() - t0).toBeLessThan(1500)
    expect(out).toContain('x</a>')
  })

  it('minifies a tag holding a huge run of spaces in linear time', () => {
    const t0 = performance.now()
    util.apply('<a b="1"' + ' '.repeat(200_000) + 'c="2"/>', {})
    expect(performance.now() - t0).toBeLessThan(1500)
  })
})
