import { describe, it, expect } from 'vitest'
import util from './index'
import toHtml from '../markdown_to_html/index'

describe('html_to_markdown', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('html_to_markdown')
    expect(util.name).toBe('html to markdown')
    expect(util.category).toBe('Data Formats')
    expect(util.accepts).toBe('string')
    expect(util.produces).toBe('string')
    expect(Object.keys(util.params).sort()).toEqual(['bulletMarker', 'codeBlockStyle', 'headingStyle'])
  })

  it('converts a realistic article with defaults', async () => {
    const html =
      '<h2>Title</h2><p>Hello <strong>there</strong> and <a href="https://ex.com">link</a>.</p>' +
      '<ul><li>one</li><li>two</li></ul>'
    expect(await util.apply(html, {})).toBe(
      '## Title\n\nHello **there** and [link](https://ex.com).\n\n-   one\n-   two'
    )
  })

  it('returns empty output for empty or whitespace-only input', async () => {
    expect(await util.apply('', {})).toBe('')
    expect(await util.apply('   \n  ', {})).toBe('')
  })

  it('preserves unicode, including astral characters', async () => {
    expect(await util.apply('<p>café 😀 <em>ok</em> <code>x</code></p>', {})).toBe('café 😀 _ok_ `x`')
  })

  it('honours the headingStyle param', async () => {
    const html = '<h1>Hello</h1><h2>Sub</h2>'
    expect(await util.apply(html, { headingStyle: 'atx' })).toBe('# Hello\n\n## Sub')
    expect(await util.apply(html, { headingStyle: 'setext' })).toBe('Hello\n=====\n\nSub\n---')
  })

  it('honours the bulletMarker param for every option', async () => {
    const html = '<ul><li>a</li><li>b</li></ul>'
    expect(await util.apply(html, { bulletMarker: '-' })).toBe('-   a\n-   b')
    expect(await util.apply(html, { bulletMarker: '*' })).toBe('*   a\n*   b')
    expect(await util.apply(html, { bulletMarker: '+' })).toBe('+   a\n+   b')
  })

  it('honours the codeBlockStyle param', async () => {
    const html = '<pre><code>x=1\ny=2</code></pre>'
    expect(await util.apply(html, { codeBlockStyle: 'fenced' })).toBe('```\nx=1\ny=2\n```')
    expect(await util.apply(html, { codeBlockStyle: 'indented' })).toBe('    x=1\n    y=2')
  })

  it('keeps images and nested inline markup', async () => {
    expect(await util.apply('<p><img src="i.png" alt="pic"> and <em><strong>x</strong></em></p>', {}))
      .toBe('![pic](i.png) and _**x**_')
  })

  it('drops script and style source instead of spilling it into the prose', async () => {
    const html = '<style>p{color:red}</style><p>Body</p><script>var a = 1</script>'
    expect(await util.apply(html, {})).toBe('Body')
  })

  it('round-trips markdown through html and back, unicode included', async () => {
    const md = '## Café 😀 heading\n\nSome **bold** and _naïve_ text with [a link](https://ex.com).'
    const html = await toHtml.apply(md, {})
    expect(await util.apply(html as string, {})).toBe(md)
  })

  it('rejects unknown select values with a clear message', async () => {
    await expect(util.apply('<p>a</p>', { headingStyle: 'huge' })).rejects.toThrow(/unknown heading style/)
    await expect(util.apply('<p>a</p>', { bulletMarker: '#' })).rejects.toThrow(/unknown bullet marker/)
    await expect(util.apply('<p>a</p>', { codeBlockStyle: 'tabbed' })).rejects.toThrow(
      /unknown code block style/
    )
  })

  it('rejects structured input instead of stringifying it', async () => {
    await expect(util.apply({ a: 1 } as any, {})).rejects.toThrow(/structured data/)
  })
})
