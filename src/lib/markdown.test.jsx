import { describe, it, expect } from 'vitest'
import { mdToHtml, parseFrontmatter } from './markdown'
describe('mdToHtml', () => {
  it('renders bold', () => {
    expect(mdToHtml('**hi**')).toContain('<strong>hi</strong>')
  })

  it('renders italic', () => {
    expect(mdToHtml('*hi*')).toContain('<em>hi</em>')
  })

  it('renders headings', () => {
    expect(mdToHtml('# Title')).toContain('<h1 class="md-h1">Title</h1>')
    expect(mdToHtml('## Sub')).toContain('<h2 class="md-h2">Sub</h2>')
  })

  it('renders a fenced code block, escaping its contents', () => {
    const out = mdToHtml('```\n<b>raw</b>\n```')
    expect(out).toContain('<pre class="md-pre" tabindex="0" aria-label="code">')
    expect(out).toContain('&lt;b&gt;raw&lt;/b&gt;')
    expect(out).not.toContain('<b>raw</b>')
  })

  it('renders inline code, escaping its contents', () => {
    expect(mdToHtml('`<i>x</i>`')).toContain('<code class="md-code">&lt;i&gt;x&lt;/i&gt;</code>')
  })

  it('renders a markdown link with target/rel', () => {
    const out = mdToHtml('[docs](https://example.com/a?b=1)')
    expect(out).toContain('<a class="md-link" href="https://example.com/a?b=1" target="_blank" rel="noopener noreferrer">docs</a>')
  })

  it('falls back a javascript: link href to "#" instead of passing it through', () => {
    const out = mdToHtml('[click me](javascript:alert(1))')
    expect(out).toContain('href="#"')
    expect(out).not.toContain('href="javascript:')
  })

  it('escapes raw HTML in a paragraph instead of letting it become a real tag', () => {
    const out = mdToHtml('before <img src=x onerror="alert(1)"> after')
    expect(out).not.toContain('<img')
    expect(out).toContain('&lt;img')
  })

  it('escapes raw HTML in a heading line', () => {
    const out = mdToHtml('# <script>alert(1)</script>')
    expect(out).not.toContain('<script>')
    expect(out).toContain('&lt;script&gt;')
    // the heading itself still renders as a real <h1>
    expect(out).toContain('<h1 class="md-h1">')
  })

  it('still formats bold/italic/links inside text that also contains escaped raw HTML', () => {
    const out = mdToHtml('**bold** <b>not bold</b> [link](https://example.com)')
    expect(out).toContain('<strong>bold</strong>')
    expect(out).toContain('&lt;b&gt;not bold&lt;/b&gt;')
    expect(out).toContain('<a class="md-link" href="https://example.com"')
  })
})

function toDom(html) {
  const div = document.createElement('div')
  div.innerHTML = html
  return div
}

describe('mdToHtml (review regressions)', () => {
  it('never lets an injected <img onerror> survive as an element', () => {
    const dom = toDom(mdToHtml('# hi <img src=x onerror=alert(1)>\n\ntext <img src=x onerror=alert(1)> **b**'))
    expect(dom.querySelector('img')).toBeNull()
    expect(dom.querySelector('[onerror]')).toBeNull()
    expect(dom.querySelector('strong')?.textContent).toBe('b')
  })

  it('cannot break out of a link href with quotes', () => {
    const dom = toDom(mdToHtml('[x](https://a.com/"onmouseover="alert(1))'))
    const a = dom.querySelector('a')
    expect(a.getAttributeNames().sort()).toEqual(['class', 'href', 'rel', 'target'])
  })

  it('rejects backslash protocol-relative hrefs that browsers treat as //host', () => {
    expect(mdToHtml(String.raw`[x](/\evil.com)`)).toContain('href="#"')
    expect(mdToHtml('[x](//evil.com)')).toContain('href="#"')
    expect(mdToHtml('[x](/docs)')).toContain('href="/docs"')
  })

  it('treats a literal placeholder-looking NUL sequence in the source as text', () => {
    const out = mdToHtml('```\ncode\n```\n\nx\u0000BLOCK0\u0000y \u0000BLOCK9\u0000')
    expect(out).not.toContain('undefined')
    expect(out.match(/<pre/g)).toHaveLength(1)
    expect(out).not.toContain('\u0000')
  })

  it('does not apply emphasis or links inside inline code', () => {
    const out = mdToHtml('`**not bold** [a](https://x.com)`')
    expect(out).toContain('<code class="md-code">**not bold** [a](https://x.com)</code>')
  })

  it('handles CRLF line endings (paragraphs split, headings clean)', () => {
    const dom = toDom(mdToHtml('# Title\r\n\r\nfirst\r\n\r\nsecond'))
    expect(dom.querySelector('h1')?.textContent).toBe('Title')
    expect([...dom.querySelectorAll('p')].map(p => p.textContent)).toEqual(['first', 'second'])
  })

  it('does not let emphasis span paragraphs', () => {
    const dom = toDom(mdToHtml('a * b\n\nc * d'))
    expect(dom.querySelector('em')).toBeNull()
  })
})

describe('parseFrontmatter', () => {
  it('parses LF and CRLF frontmatter and strips wrapping quotes', () => {
    for (const nl of ['\n', '\r\n']) {
      const { frontmatter, body } = parseFrontmatter(['---', 'title: "Hello: World"', "tag: 'x'", 'date: 2025-01-15', '---', '# Body'].join(nl))
      expect(frontmatter.title).toBe('Hello: World')
      expect(frontmatter.tag).toBe('x')
      expect(frontmatter.date).toBe('2025-01-15')
      expect(body.trim()).toBe('# Body')
    }
  })

  it('returns the whole text as body when there is no frontmatter', () => {
    expect(parseFrontmatter('# Just body')).toEqual({ frontmatter: {}, body: '# Just body' })
  })
})

describe('mdToHtml links', () => {
  it('opens only off-site links in a new tab', () => {
    const dom = toDom(mdToHtml('[post](#/blog/other) [ext](https://example.com)'))
    const [internal, external] = dom.querySelectorAll('a')
    expect(internal.getAttribute('href')).toBe('#/blog/other')
    expect(internal.hasAttribute('target')).toBe(false)
    expect(external.getAttribute('target')).toBe('_blank')
    expect(external.getAttribute('rel')).toBe('noopener noreferrer')
  })

  it('keeps the anchor well-formed when a code span sits inside the url', () => {
    // the held-out <code class="md-code"> used to be restored inside href="…",
    // where its own quotes closed the attribute early
    for (const src of ['[a](https://x.com/`code`)', '[a](https://```x```)']) {
      const dom = toDom(mdToHtml(src))
      for (const a of dom.querySelectorAll('a')) {
        expect(a.getAttributeNames().sort()).toEqual(['class', 'href', 'rel', 'target'])
        expect(a.getAttribute('href')).not.toMatch(/[<>"]/)
      }
    }
  })

  it('never lets emphasis reach into a link href or straddle the anchor tag', () => {
    const a1 = toDom(mdToHtml('[x*](https://a.com/*)')).querySelector('a')
    expect(a1.getAttribute('href')).toBe('https://a.com/*')
    expect(a1.textContent).toBe('x*')

    const a2 = toDom(mdToHtml('*[a](https://x.com/*)')).querySelector('a')
    expect(a2.getAttribute('href')).toBe('https://x.com/*')

    // emphasis around and inside a link label still works
    const dom = toDom(mdToHtml('*see [**bold** docs](https://x.com)*'))
    expect(dom.querySelector('em > a > strong')?.textContent).toBe('bold')
  })

  it('lifts a fenced block written mid-line out of the paragraph instead of nesting <pre> in <p>', () => {
    const html = mdToHtml('text ```inline``` more')
    // (checked on the string: a DOM parse would silently auto-close the <p>)
    expect(html).not.toMatch(/<p[^>]*>(?:(?!<\/p>)[^])*<pre/)
    const dom = toDom(html)
    expect(dom.querySelector('pre code')?.textContent).toBe('inline')
    expect([...dom.querySelectorAll('p')].map(p => p.textContent.trim())).toEqual(['text', 'more'])
  })

  it('does not italicise asterisks surrounded by spaces (e.g. arithmetic)', () => {
    expect(mdToHtml('2 * 3 * 4')).not.toContain('<em>')
    expect(mdToHtml('a ** b ** c')).not.toContain('<strong>')
    expect(mdToHtml('**a** and *b*')).toContain('<strong>a</strong> and <em>b</em>')
  })

  it('renders a heading directly followed by a fenced block (as the shipped posts do)', () => {
    const dom = toDom(mdToHtml('## Example\n```js\nconst a = 1 < 2\n```\ntrailing'))
    expect(dom.querySelector('h2')?.textContent).toBe('Example')
    // the ```js info string is a language hint, not part of the code
    expect(dom.querySelector('pre code')?.textContent).toBe('const a = 1 < 2')
    expect(dom.querySelector('pre code')?.getAttribute('data-lang')).toBe('js')
    expect(dom.querySelector('p')?.textContent).toBe('trailing')
    expect(dom.querySelector('p pre, h2 pre')).toBeNull()
  })
})
