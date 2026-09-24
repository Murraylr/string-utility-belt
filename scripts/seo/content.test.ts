import { describe, it, expect } from 'vitest'
import type { UtilityMeta } from '../../src/core/registry'
import {
  renderUtilityContent, renderUtilitiesIndexContent, renderBlogIndexContent,
  renderBlogPostContent, renderChangelogContent,
} from './content'

const XSS = '"><script>alert(1)</script>'

function meta(overrides: Partial<UtilityMeta> = {}): UtilityMeta {
  return {
    id: 'trim',
    name: 'trim',
    category: 'String Ops',
    description: 'Removes leading and trailing whitespace.',
    accepts: 'string',
    produces: 'string',
    params: {},
    tags: [],
    aliases: [],
    env: [],
    streamable: true,
    exampleCount: 0,
    ...overrides,
  }
}

describe('renderUtilityContent', () => {
  it('includes name, category and description', () => {
    const html = renderUtilityContent(meta(), [])
    expect(html).toContain('trim')
    expect(html).toContain('String Ops')
    expect(html).toContain('Removes leading and trailing whitespace.')
  })

  it('escapes an attacker-controlled description/name so no tag is injected', () => {
    const html = renderUtilityContent(meta({ name: XSS, description: XSS }), [])
    expect(html).not.toContain('<script>alert(1)</script>')
  })

  it('renders a parameter table when params exist', () => {
    const html = renderUtilityContent(meta({
      params: { count: { kind: 'number', label: 'count', default: 1, min: 0, max: 10 } },
    }), [])
    expect(html).toContain('<table>')
    expect(html).toContain('count')
    expect(html).toContain('0–10')
  })

  it('renders examples and escapes their content', () => {
    const html = renderUtilityContent(meta(), [{ title: 'basic', input: XSS, output: 'ok' }])
    expect(html).toContain('basic')
    expect(html).not.toContain('<script>alert(1)</script>')
  })

  it('labels example inputs that are stored encoded (hex/base64 bytes), not plain text', () => {
    const html = renderUtilityContent(meta(), [
      { input: '1f8b08', inputEncoding: 'hex', output: 'x' },
      { input: 'plain', output: 'plain' },
    ])
    expect(html).toContain('<p>input (hex)</p>')
    expect(html.match(/<p>input<\/p>/g)).toHaveLength(1)
  })

  it('omits the params/examples sections when there are none', () => {
    const html = renderUtilityContent(meta(), [])
    expect(html).not.toContain('<table>')
    expect(html).not.toContain('<h2>Examples</h2>')
  })
})

describe('renderUtilitiesIndexContent', () => {
  it('groups utilities by category and links to their doc page', () => {
    const html = renderUtilitiesIndexContent([meta(), meta({ id: 'reverse', name: 'reverse', category: 'String Ops' })])
    expect(html).toContain('String Ops (2)')
    expect(html).toContain('/util/trim/')
    expect(html).toContain('/util/reverse/')
  })

  it('escapes a malicious utility name', () => {
    const html = renderUtilitiesIndexContent([meta({ name: XSS })])
    expect(html).not.toContain('<script>alert(1)</script>')
  })
})

describe('renderBlogIndexContent', () => {
  it('lists posts with a link and date', () => {
    const html = renderBlogIndexContent([{ slug: 'a', title: 'Post A', date: '2025-09-18', description: 'desc' }])
    expect(html).toContain('/blog/a/')
    expect(html).toContain('Post A')
    expect(html).toContain('2025-09-18')
  })

  it('shows an empty state with no posts', () => {
    expect(renderBlogIndexContent([])).toContain('No posts yet.')
  })

  it('escapes a malicious post title', () => {
    const html = renderBlogIndexContent([{ slug: 'a', title: XSS }])
    expect(html).not.toContain('<script>alert(1)</script>')
  })
})

describe('renderBlogPostContent', () => {
  it('wraps the pre-rendered body and escapes the frontmatter title', () => {
    const html = renderBlogPostContent({ title: XSS, date: '2025-09-18' }, '<p class="md-p">safe body</p>')
    expect(html).not.toContain('<script>alert(1)</script>')
    expect(html).toContain('safe body')
  })
})

describe('renderChangelogContent', () => {
  it('wraps pre-rendered changelog HTML without adding a second h1 (the markdown has its own)', () => {
    const html = renderChangelogContent('<h1 class="md-h1">Changelog</h1><p class="md-p">x</p>')
    expect(html).toContain('<h1 class="md-h1">Changelog</h1>')
    expect(html.match(/<h1/g)).toHaveLength(1)
  })
})
