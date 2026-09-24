import { describe, it, expect } from 'vitest'
import util from './index'
import toMarkdown from '../html_to_markdown/index'

describe('markdown_to_html', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('markdown_to_html')
    expect(util.name).toBe('markdown to html')
    expect(util.category).toBe('Data Formats')
    expect(util.accepts).toBe('string')
    expect(util.produces).toBe('string')
    expect(Object.keys(util.params).sort()).toEqual(['breaks', 'gfm', 'headerIds'])
  })

  it('renders a realistic document with defaults', async () => {
    expect(await util.apply('# Hi\n\nsome *text*', {})).toBe('<h1>Hi</h1>\n<p>some <em>text</em></p>\n')
  })

  it('returns empty output for empty input', async () => {
    expect(await util.apply('', {})).toBe('')
  })

  it('preserves unicode, including astral characters', async () => {
    expect(await util.apply('Café 😀 **naïve**', {})).toBe('<p>Café 😀 <strong>naïve</strong></p>\n')
  })

  it('honours the gfm param', async () => {
    const table = '| a | b |\n| --- | --- |\n| 1 | 2 |'
    expect(await util.apply(table, { gfm: true })).toContain('<table>')
    expect(await util.apply(table, { gfm: false })).not.toContain('<table>')
    expect(await util.apply('~~gone~~', { gfm: true })).toBe('<p><del>gone</del></p>\n')
    expect(await util.apply('~~gone~~', { gfm: false })).toBe('<p>~~gone~~</p>\n')
  })

  it('honours the breaks param', async () => {
    expect(await util.apply('a\nb', { breaks: true })).toBe('<p>a<br>b</p>\n')
    expect(await util.apply('a\nb', { breaks: false })).toBe('<p>a\nb</p>\n')
  })

  it('honours the headerIds param', async () => {
    expect(await util.apply('## Hello World!', { headerIds: false })).toBe('<h2>Hello World!</h2>\n')
    expect(await util.apply('## Hello World!', { headerIds: true })).toBe(
      '<h2 id="hello-world">Hello World!</h2>\n'
    )
  })

  it('builds unicode-aware and de-duplicated heading ids', async () => {
    expect(await util.apply('## Café 😀 heading', { headerIds: true })).toBe(
      '<h2 id="café-heading">Café 😀 heading</h2>\n'
    )
    const dupes = await util.apply('# A\n\n# A\n\n# A', { headerIds: true })
    expect(dupes).toBe('<h1 id="a">A</h1>\n<h1 id="a-1">A</h1>\n<h1 id="a-2">A</h1>\n')
  })

  it('strips inline markup out of generated heading ids', async () => {
    expect(await util.apply('# The `run` &amp; **go** step', { headerIds: true })).toContain(
      'id="the-run-go-step"'
    )
  })

  it('round-trips html through markdown and back, unicode included', async () => {
    const html = '<h2>Café 😀</h2>\n<p>Some <strong>bold</strong> and <em>naïve</em> text.</p>\n'
    const md = await toMarkdown.apply(html, {})
    expect(await util.apply(md as string, {})).toBe(html)
  })

  it('rejects structured input instead of stringifying it', async () => {
    await expect(util.apply({ a: 1 } as any, {})).rejects.toThrow(/structured data/)
  })
})
