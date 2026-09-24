import { describe, it, expect } from 'vitest'
import {
  escapeHtml, setTitle, setMetaDescription, extractMetaDescription, injectHead,
  setRootContent, jsonLdScript, seoMetaTags, rssLinkTag, injectSeoHead, stripSeoHead,
} from './html'

const XSS = '"><script>alert(1)</script>'

const TEMPLATE = `<!doctype html>
<html><head>
<meta name="description" content="original description">
<title>String Utility Belt</title>
</head>
<body><div id="root"></div></body></html>`

describe('escapeHtml', () => {
  it('escapes all five HTML-significant characters', () => {
    expect(escapeHtml(`& < > " '`)).toBe('&amp; &lt; &gt; &quot; &#39;')
  })

  it('neutralizes a script-injection payload used as a title/description', () => {
    const escaped = escapeHtml(XSS)
    expect(escaped).not.toContain('<script>')
    expect(escaped).not.toContain('">')
  })
})

describe('setTitle', () => {
  it('replaces the title and escapes untrusted content', () => {
    const html = setTitle(TEMPLATE, `trim — ${XSS}`)
    expect(html).toContain('&lt;script&gt;')
    expect(html).not.toContain('<script>alert(1)</script>')
    expect(html.match(/<title>/g)?.length).toBe(1)
  })
})

describe('setMetaDescription', () => {
  it('replaces an existing description tag in place', () => {
    const html = setMetaDescription(TEMPLATE, 'a new description')
    expect(html).toContain('content="a new description"')
    expect(html).not.toContain('original description')
    expect(html.match(/<meta\s+name="description"/g)?.length).toBe(1)
  })

  it('escapes an injected quote so it cannot close the attribute early', () => {
    const html = setMetaDescription(TEMPLATE, XSS)
    expect(html).not.toContain('<script>alert(1)</script>')
    expect(html).toContain('&quot;&gt;&lt;script&gt;')
  })

  it('inserts a description tag when none exists', () => {
    const noMeta = TEMPLATE.replace(/<meta name="description"[^>]*>\n?/, '')
    const html = setMetaDescription(noMeta, 'fresh description')
    expect(html).toContain('content="fresh description"')
  })
})

describe('extractMetaDescription', () => {
  it('reads the current description content', () => {
    expect(extractMetaDescription(TEMPLATE)).toBe('original description')
  })

  it('returns undefined when absent', () => {
    expect(extractMetaDescription('<html><head></head></html>')).toBeUndefined()
  })
})

describe('injectHead / setRootContent', () => {
  it('inserts markup immediately before </head>', () => {
    const html = injectHead(TEMPLATE, '<link rel="canonical" href="https://example.com/">')
    expect(html.indexOf('rel="canonical"')).toBeLessThan(html.indexOf('</head>'))
  })

  it('fills the empty root div with static content', () => {
    const html = setRootContent(TEMPLATE, '<h1>hello</h1>')
    expect(html).toContain('<div id="root"><h1>hello</h1></div>')
  })
})

describe('jsonLdScript', () => {
  it('produces parseable JSON-LD', () => {
    const data = { '@type': 'WebApplication', name: 'trim' }
    const script = jsonLdScript(data)
    const json = script.replace(/^<script[^>]*>/, '').replace(/<\/script>$/, '')
    expect(JSON.parse(json)).toEqual(data)
  })

  it('cannot be broken out of by a value containing </script>', () => {
    const script = jsonLdScript({ description: '</script><script>alert(1)</script>' })
    expect(script).not.toMatch(/<\/script>[\s\S]*<script>/)
    // still exactly one script tag (the wrapper) — the payload's tags were neutralized
    expect(script.match(/<script/g)?.length).toBe(1)
  })
})

describe('seoMetaTags', () => {
  it('escapes title/description and includes canonical + OG + Twitter tags', () => {
    const out = seoMetaTags({ title: XSS, description: XSS, canonical: 'https://x.com/a', ogImage: 'https://x.com/og.png' })
    expect(out).not.toContain('<script>alert(1)</script>')
    expect(out).toContain('rel="canonical" href="https://x.com/a"')
    expect(out).toContain('property="og:image" content="https://x.com/og.png"')
    expect(out).toContain('name="twitter:card" content="summary_large_image"')
  })
})

describe('rssLinkTag', () => {
  it('builds an alternate rss link', () => {
    expect(rssLinkTag('https://x.com/rss.xml')).toBe(
      '<link rel="alternate" type="application/rss+xml" title="String Utility Belt" href="https://x.com/rss.xml">',
    )
  })
})

describe('replacement-pattern safety ($&, $\', $`, $$ in content)', () => {
  // String#replace treats these as substitution patterns in a *string*
  // replacement; utility examples (regex replace, sed, bcrypt hashes…) contain
  // them, so every helper must insert its content literally
  const DOLLARS = "a $& b $' c $` d $$ e"

  it('setRootContent inserts content literally', () => {
    const html = setRootContent(TEMPLATE, `<p>${DOLLARS}</p>`)
    expect(html).toContain(`<div id="root"><p>${DOLLARS}</p></div>`)
    expect(html.match(/<div id="root">/g)?.length).toBe(1)
  })

  it('injectHead inserts markup literally', () => {
    const html = injectHead(TEMPLATE, `<meta name="x" content="${DOLLARS}">`)
    expect(html).toContain(`<meta name="x" content="${DOLLARS}">`)
    expect(html.match(/<\/head>/g)?.length).toBe(1)
  })

  it('setTitle inserts the (escaped) title literally', () => {
    const html = setTitle(TEMPLATE, DOLLARS)
    expect(html).toContain(`<title>${escapeHtml(DOLLARS)}</title>`)
    expect(html.match(/<title>/g)?.length).toBe(1)
  })

  it('setMetaDescription inserts the (escaped) description literally', () => {
    const html = setMetaDescription(TEMPLATE, DOLLARS)
    expect(html).toContain(`content="${escapeHtml(DOLLARS)}"`)
    expect(html.match(/<meta\s+name="description"/g)?.length).toBe(1)
  })
})

describe('extractMetaDescription (decoding)', () => {
  it('decodes entities so the value is not double-escaped when re-emitted', () => {
    const html = '<head><meta name="description" content="Tom &amp; Jerry &quot;cats&quot; &#39;n&#39; mice"></head>'
    expect(extractMetaDescription(html)).toBe(`Tom & Jerry "cats" 'n' mice`)
  })

  it('does not stop at an apostrophe inside a double-quoted value', () => {
    expect(extractMetaDescription(`<meta name="description" content="Don't panic">`)).toBe("Don't panic")
  })
})

describe('injectSeoHead / stripSeoHead', () => {
  it('round-trips: stripping removes exactly what was injected', () => {
    const injected = injectSeoHead(TEMPLATE, '<link rel="canonical" href="https://x.com/">')
    expect(injected).toContain('rel="canonical"')
    expect(stripSeoHead(injected)).toBe(TEMPLATE)
  })

  it('removes several injected blocks', () => {
    const twice = injectSeoHead(injectSeoHead(TEMPLATE, '<meta name="a">'), '<meta name="b">')
    expect(stripSeoHead(twice)).toBe(TEMPLATE)
  })
})

describe('missing anchors fail loudly', () => {
  it('setRootContent throws when the template has no empty #root', () => {
    expect(() => setRootContent('<html><body></body></html>', '<p>x</p>')).toThrow(/root/)
  })

  it('injectHead throws when the template has no </head>', () => {
    expect(() => injectHead('<html><body></body></html>', '<meta>')).toThrow(/head/)
  })
})
