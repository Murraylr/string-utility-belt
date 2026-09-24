import { describe, it, expect } from 'vitest'
import util from './index'

describe('strip_html_tags', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('strip_html_tags')
    expect(util.name).toBe('strip html tags')
    expect(util.category).toBe('String Ops')
    expect(util.accepts).toBe('string')
    expect(util.produces).toBe('string')
    expect(Object.keys(util.params).sort()).toEqual([
      'allowedTags',
      'decodeEntities',
      'preserveBreaks'
    ])
  })

  it('strips a realistic fragment with defaults', async () => {
    const html =
      '<div class="post"><h1>Hello</h1><p>Some <b>bold</b> text &amp; more.</p>' +
      '<ul><li>one</li><li>two</li></ul></div>'
    expect(await util.apply(html, {})).toBe('Hello\n\nSome bold text & more.\n\none\ntwo')
  })

  it('returns empty output for empty input', async () => {
    expect(await util.apply('', {})).toBe('')
    expect(await util.apply('<p></p>', {})).toBe('')
  })

  it('honours preserveBreaks', async () => {
    expect(await util.apply('<p>a</p><p>b</p>', { preserveBreaks: true })).toBe('a\n\nb')
    expect(await util.apply('<p>a</p><p>b</p>', { preserveBreaks: false })).toBe('a b')
    expect(await util.apply('one<br>two', { preserveBreaks: true })).toBe('one\ntwo')
    expect(await util.apply('one<br>two', { preserveBreaks: false })).toBe('one two')
  })

  it('honours decodeEntities, including named, numeric and astral references', async () => {
    const html = '<p>Caf&eacute; &amp; co &mdash; &#128512; &#x1F609;</p>'
    expect(await util.apply(html, { decodeEntities: true })).toBe('Café & co — 😀 😉')
    expect(await util.apply(html, { decodeEntities: false })).toBe(
      'Caf&eacute; &amp; co &mdash; &#128512; &#x1F609;'
    )
  })

  it('honours allowedTags', async () => {
    expect(await util.apply('<p>Hello <b>world</b></p>', { allowedTags: '' })).toBe('Hello world')
    expect(await util.apply('<p>Hello <b>world</b></p>', { allowedTags: 'b' })).toBe(
      'Hello <b>world</b>'
    )
    expect(await util.apply('<p><i>a</i> <b>b</b></p>', { allowedTags: 'b, i' })).toBe(
      '<i>a</i> <b>b</b>'
    )
  })

  it('drops script and style contents, comments and doctypes', async () => {
    const html =
      '<!DOCTYPE html><!-- secret --><style>p{color:red}</style><div>text</div>' +
      '<script>var a = 1;</script>'
    const out = await util.apply(html, {})
    expect(out).toBe('text')
    expect(out).not.toContain('secret')
  })

  it('handles tables, attributes containing angle brackets, and unicode text', async () => {
    expect(await util.apply('<table><tr><td>1</td><td>2</td></tr></table>', {})).toBe('1 2')
    expect(await util.apply('<a title="a > b" href="#">go 😀</a>', {})).toBe('go 😀')
    expect(await util.apply('<p>日本語 テキスト</p>', {})).toBe('日本語 テキスト')
  })

  it('remaps windows-1252 numeric references the way html parsers do', async () => {
    // 0x80-0x9F numeric refs mean windows-1252 characters, not C1 controls.
    expect(await util.apply('a &#151; b', {})).toBe('a — b')
    expect(await util.apply('&#128; &#x92;', {})).toBe('€ ’')
    // Slots with no windows-1252 character keep their code point.
    expect(await util.apply('&#129;', {})).toBe('\u0081')
  })

  it('replaces unusable numeric references instead of emitting broken text', async () => {
    expect(await util.apply('&#0;', {})).toBe('�')
    expect(await util.apply('&#xD800;', {})).toBe('�')
    expect(await util.apply('&#x110000;', {})).toBe('�')
  })

  it('never rewrites the markup of a tag kept by allowedTags', async () => {
    // The `&amp;` inside the href must survive entity decoding, or the kept
    // markup comes back subtly wrong.
    expect(
      await util.apply('<p>Caf&eacute; <a href="?a=1&amp;b=2">link</a></p>', { allowedTags: 'a' })
    ).toBe('Café <a href="?a=1&amp;b=2">link</a>')
    // Kept tags also survive whitespace tidying untouched.
    expect(await util.apply('<div><b>a</b>   <b>b</b></div>', { allowedTags: 'b' })).toBe(
      '<b>a</b> <b>b</b>'
    )
  })

  it('does not treat decoded entities as new tags', async () => {
    expect(await util.apply('<p>&lt;b&gt;not bold&lt;/b&gt;</p>', {})).toBe('<b>not bold</b>')
  })

  it('rejects a malformed allowedTags list', async () => {
    expect(() => util.apply('<p>a</p>', { allowedTags: '<b>' })).toThrow(/invalid tag name/)
    expect(() => util.apply('<p>a</p>', { allowedTags: 'b, 2cool' })).toThrow(/invalid tag name/)
  })

  it('rejects structured input instead of stringifying it', async () => {
    expect(() => util.apply({ a: 1 } as any, {})).toThrow(/structured data/)
  })
})
