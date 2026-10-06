import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync, rmSync, copyFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { UtilityMeta } from '../../src/core/registry'
import { MANIFEST } from '../../src/utilities/_generated/manifest'
import { buildSeo, SITE } from './build'
import { parseGuide } from '../../src/app/pages/guide'
import { POPULAR_UTILITY_IDS, DOCS_DESCRIPTION, DOCS_TITLE, displayName, homeDescription, pageTitle } from '../../src/app/pages/seo'
import { SITE_PAGES } from '../../src/lib/router'
import { resolveOg, resolveOutDir } from '../build-seo'

const ROOT = process.cwd()
const NOW = new Date('2026-01-02T03:04:05Z')
const XSS = `"><script>alert(1)</script> $' $& $$`

/** Shaped like Vite's built index.html: description meta, title, empty #root, module script. */
const TEMPLATE = `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="description" content="String Pipeline Workshop &amp; friends — chain elegant string utilities with previews." />
  <title>String Utility Belt</title>
  <script type="module" crossorigin src="/assets/index-abc123.js"></script>
</head>
<body class="min-h-screen">
  <div id="root"></div>
</body>
</html>
`

const tmpDirs: string[] = []

function fixtureDist(): string {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'build-seo-'))
  tmpDirs.push(dir)
  writeFileSync(path.join(dir, 'index.html'), TEMPLATE)
  const blog = path.join(dir, 'blog')
  mkdirSync(blog)
  const shipped = JSON.parse(readFileSync(path.join(ROOT, 'public', 'blog', '_manifest.json'), 'utf8'))
  for (const post of shipped) copyFileSync(path.join(ROOT, 'public', 'blog', `${post.slug}.md`), path.join(blog, `${post.slug}.md`))
  writeFileSync(path.join(blog, '_manifest.json'), JSON.stringify([
    ...shipped,
    { slug: 'no-markdown-file', title: 'Ghost post', date: '2025-10-01' },
    { slug: '../../escape', title: 'Traversal', date: '2025-10-01' },
  ]))
  return dir
}

const read = (dir: string, rel: string) => readFileSync(path.join(dir, rel), 'utf8')
const html = (source: string) => new DOMParser().parseFromString(source, 'text/html')
const xml = (source: string) => {
  const doc = new DOMParser().parseFromString(source, 'application/xml')
  expect(doc.getElementsByTagName('parsererror')).toHaveLength(0)
  return doc
}
const silent = () => {}
/** The shipped `src/utilities/<id>/guide.md`, parsed, when there is one. */
const shippedGuide = (id: string) => {
  const file = path.join(ROOT, 'src', 'utilities', id, 'guide.md')
  return existsSync(file) ? parseGuide(readFileSync(file, 'utf8')) : undefined
}

afterAll(() => {
  for (const dir of tmpDirs) rmSync(dir, { recursive: true, force: true })
})

describe('buildSeo utility guides', () => {
  const GUIDE = [
    '---', 'title: Trim Whitespace Online — Strip Spaces', 'description: Strip leading and trailing whitespace. $& $$', '---',
    '## What it removes', '', `Everything ${XSS}`, '',
    '```example', 'input:   padded', 'output: padded', '```',
  ].join('\n')
  const trim = MANIFEST.find(m => m.id === 'trim')!
  const pad = MANIFEST.find(m => m.id === 'pad')!
  let dist: string
  const logs: string[] = []

  beforeAll(async () => {
    dist = fixtureDist()
    await buildSeo({ outDir: dist, root: ROOT, og: false, now: NOW, log: m => logs.push(m), manifest: [trim, pad], examples: {}, guides: { trim: GUIDE } })
  }, 60000)

  it("takes the page title and description from the guide's frontmatter", () => {
    const doc = html(read(dist, 'util/trim/index.html'))
    expect(doc.title).toBe('Trim Whitespace Online — Strip Spaces — String Utility Belt')
    expect(doc.querySelector('meta[name="description"]')?.getAttribute('content')).toBe('Strip leading and trailing whitespace. $& $$')
    expect(doc.querySelector('meta[property="og:title"]')?.getAttribute('content')).toBe('Trim Whitespace Online — Strip Spaces — String Utility Belt')
    const ld = JSON.parse(doc.querySelector('script[type="application/ld+json"]')!.textContent!)
    expect(ld.description).toBe('Strip leading and trailing whitespace. $& $$')
  })

  it('pre-renders the guide in a collapsed <details> under an h2, escaped', () => {
    const source = read(dist, 'util/trim/index.html')
    expect(source).not.toContain('<script>alert(1)</script>')
    const details = html(source).querySelector('#root details')!
    expect(details.hasAttribute('open')).toBe(false)
    expect(details.querySelector('summary h2')?.textContent).toBe('How trim works')
    expect(details.querySelector('h3')?.textContent).toBe('What it removes')
    expect(details.querySelector('figure.guide-example')?.textContent).toContain('padded')
  })

  it('falls back to the utility name/description, with no guide section, when there is no guide', () => {
    const doc = html(read(dist, 'util/pad/index.html'))
    expect(doc.title).toBe(`${pad.name} — String Utility Belt`)
    expect(doc.querySelector('#root details')).toBeNull()
    expect(logs).toContain('[build-seo] warning: 1 of 2 utilities have no guide.md')
  })
})

describe('buildSeo over a built dist/', () => {
  let dist: string
  let result: Awaited<ReturnType<typeof buildSeo>>
  const logs: string[] = []

  beforeAll(async () => {
    dist = fixtureDist()
    result = await buildSeo({ outDir: dist, root: ROOT, og: false, now: NOW, log: m => logs.push(m) })
  }, 60000)

  it('writes one crawlable page per utility, plus the index, blog, changelog, docs, site pages and 404', () => {
    const utilDirs = readdirSync(path.join(dist, 'util'))
    expect(utilDirs.sort()).toEqual(MANIFEST.map(m => m.id).sort())
    for (const rel of ['utilities/index.html', 'blog/index.html', 'changelog/index.html', 'docs/index.html',
      'blog/base64-encode-decode-online/index.html', 'blog/md5-insecure-but-useful/index.html',
      'about/index.html', 'privacy/index.html', 'contact/index.html', 'integrations/index.html', '404.html']) {
      expect(existsSync(path.join(dist, rel)), rel).toBe(true)
    }
    expect(result.pages).toBe(MANIFEST.length + 11)
  })

  it('gives every utility page exactly one title and canonical, and JSON-LD that parses', () => {
    // string-level over all pages (a jsdom parse of every page takes ~15s)
    for (const meta of MANIFEST) {
      const source = read(dist, `util/${meta.id}/index.html`)
      expect(source.match(/<title>/g), meta.id).toHaveLength(1)
      expect(source.match(/rel="canonical"/g), meta.id).toHaveLength(1)
      expect(source).toContain(`<link rel="canonical" href="${SITE}/util/${meta.id}/">`)
      const ld = [...source.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(m => JSON.parse(m[1]))
      expect(ld.map(d => d['@type']), meta.id).toEqual(['WebApplication', 'BreadcrumbList'])
    }
  })

  it('fills utility pages with the right metadata and static content (DOM-parsed sample)', () => {
    const sample = MANIFEST.filter((_, i) => i % 25 === 0).concat(MANIFEST.filter(m => /tabs_spaces|trim|aes_decrypt/.test(m.id)))
    for (const meta of sample) {
      const doc = html(read(dist, `util/${meta.id}/index.html`))
      const guide = shippedGuide(meta.id)
      expect(doc.title).toBe(pageTitle(guide?.title ?? displayName(meta.name)))
      expect(doc.title.length <= 60 || doc.title === guide?.title, meta.id).toBe(true)
      const canonicals = doc.querySelectorAll('link[rel="canonical"]')
      expect(canonicals, meta.id).toHaveLength(1)
      expect(canonicals[0].getAttribute('href')).toBe(`${SITE}/util/${meta.id}/`)
      expect(doc.querySelector('meta[property="og:image"]')?.getAttribute('content')).toBe(`${SITE}/og/${meta.id}.png`)
      expect(doc.querySelector('meta[name="description"]')?.getAttribute('content')).toBe(guide?.description ?? meta.description)
      expect(!!doc.querySelector('#root details'), meta.id).toBe(!!guide)
      const ld = [...doc.querySelectorAll('script[type="application/ld+json"]')].map(s => JSON.parse(s.textContent!))
      expect(ld.map(d => d['@type'])).toEqual(['WebApplication', 'BreadcrumbList'])
      expect(ld[0].name).toBe(displayName(meta.name))
      expect(doc.querySelector('#root h1')?.textContent).toBe(displayName(meta.name))
    }
  })

  it('links related utilities by their crawlable /util/<id>/ paths', () => {
    const doc = html(read(dist, 'util/url_decode/index.html'))
    const related = [...doc.querySelectorAll('#root section')].find(s => s.querySelector('h2')?.textContent === 'Related utilities')!
    const hrefs = [...related.querySelectorAll('a')].map(a => a.getAttribute('href'))
    expect(hrefs[0]).toBe('/util/url_encode/')
    expect(hrefs.every(h => /^\/util\/[a-z0-9_]+\/$/.test(h!))).toBe(true)
  })

  it('keeps the built app script so React mounts over the static content', () => {
    const doc = html(read(dist, 'util/trim/index.html'))
    expect(doc.querySelector('script[type="module"]')?.getAttribute('src')).toBe('/assets/index-abc123.js')
  })

  it('gives the home page its title, RSS discovery, canonical, default OG and site-name JSON-LD', () => {
    const doc = html(read(dist, 'index.html'))
    expect(doc.title).toBe('Free Online String & Text Tools — String Utility Belt')
    expect(doc.querySelector('link[rel="alternate"][type="application/rss+xml"]')?.getAttribute('href')).toBe(`${SITE}/rss.xml`)
    expect(doc.querySelectorAll('link[rel="canonical"]')).toHaveLength(1)
    expect(doc.querySelector('meta[property="og:image"]')?.getAttribute('content')).toBe(`${SITE}/og/default.png`)
    expect(doc.querySelector('meta[name="description"]')?.getAttribute('content')).toBe(homeDescription(MANIFEST.length))
    expect(doc.querySelector('meta[property="og:description"]')?.getAttribute('content')).toBe(homeDescription(MANIFEST.length))
    const ld = [...doc.querySelectorAll('script[type="application/ld+json"]')].map(s => JSON.parse(s.textContent!))
    expect(ld.map(d => d['@type'])).toEqual(['WebSite', 'WebApplication'])
    expect(ld[0]).toMatchObject({ name: 'String Utility Belt', url: `${SITE}/` })
  })

  it('pre-renders the home page with crawlable links to the popular utilities', () => {
    const doc = html(read(dist, 'index.html'))
    expect(doc.querySelector('#root h1')?.textContent).toBe('String Utility Belt')
    const hrefs = [...doc.querySelectorAll('#root main a')].map(a => a.getAttribute('href'))
    expect(hrefs).toEqual(expect.arrayContaining(POPULAR_UTILITY_IDS.map(id => `/util/${id}/`)))
    expect(hrefs).toContain('/utilities/')
  })

  it('surrounds every pre-rendered page with the site nav and footer links', () => {
    for (const rel of ['index.html', 'util/trim/index.html', 'utilities/index.html', 'blog/index.html', 'changelog/index.html', 'docs/index.html', 'privacy/index.html', '404.html']) {
      const doc = html(read(dist, rel))
      const footer = [...doc.querySelectorAll('#root footer a')].map(a => a.getAttribute('href'))
      expect(footer, rel).toEqual(['/utilities/', '/blog/', '/changelog/', '/integrations/', '/about/', '/privacy/', '/contact/'])
      expect([...doc.querySelectorAll('#root > header nav a')].map(a => a.getAttribute('href')), rel)
        .toEqual(['/', '/docs/', '/utilities/', '/blog/', '/changelog/'])
    }
  })

  it('pre-renders the usage guide from the Docs component, with the head the app sets at runtime', () => {
    const doc = html(read(dist, 'docs/index.html'))
    expect(doc.title).toBe(DOCS_TITLE)
    expect(doc.querySelector('meta[name="description"]')?.getAttribute('content')).toBe(DOCS_DESCRIPTION)
    expect(doc.querySelectorAll('link[rel="canonical"]')).toHaveLength(1)
    expect(doc.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(`${SITE}/docs/`)
    expect(doc.querySelector('meta[property="og:image"]')?.getAttribute('content')).toBe(`${SITE}/og/default.png`)
    const ld = [...doc.querySelectorAll('script[type="application/ld+json"]')].map(s => JSON.parse(s.textContent!))
    expect(ld).toEqual([expect.objectContaining({
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE}/` },
        { '@type': 'ListItem', position: 2, name: 'Docs', item: `${SITE}/docs/` },
      ],
    })])
    const main = doc.querySelector('#root main')!
    expect([...main.querySelectorAll('h1')].map(h => h.textContent)).toEqual(['How to use String Utility Belt'])
    expect(main.querySelector('section#utilities h2')?.textContent).toBe('Utility reference')
    // crawlable paths only: no #/ route links left in the static page
    const hrefs = [...doc.querySelectorAll('#root a')].map(a => a.getAttribute('href'))
    expect(hrefs).toEqual(expect.arrayContaining(['/', '/utilities/']))
    expect(hrefs.filter(h => h?.includes('#'))).toEqual([])
    expect(doc.querySelector('script[type="module"]')?.getAttribute('src')).toBe('/assets/index-abc123.js')
  })

  it('pre-renders the about, privacy, contact and integrations pages from their markdown', () => {
    for (const slug of SITE_PAGES) {
      const doc = html(read(dist, `${slug}/index.html`))
      expect(doc.querySelector('link[rel="canonical"]')?.getAttribute('href'), slug).toBe(`${SITE}/${slug}/`)
      expect(doc.querySelectorAll('#root h1'), slug).toHaveLength(1)
      expect(doc.querySelector('meta[name="description"]')?.getAttribute('content')?.length, slug).toBeGreaterThanOrEqual(80)
      const ld = [...doc.querySelectorAll('script[type="application/ld+json"]')].map(s => JSON.parse(s.textContent!))
      expect(ld.map(d => d['@type'])[1], slug).toBe('BreadcrumbList')
    }
    expect(html(read(dist, 'privacy/index.html')).title).toBe('Privacy Policy — String Utility Belt')
    // AdSense's required disclosures, with the opt-out link
    const privacy = html(read(dist, 'privacy/index.html')).querySelector('#root main')!
    expect(privacy.textContent).toContain('Third-party vendors, including Google, use cookies to serve ads')
    expect([...privacy.querySelectorAll('a')].map(a => a.getAttribute('href'))).toContain('https://adssettings.google.com/')
  })

  it('writes a 404 page that is kept out of the index and links back into the site', () => {
    const doc = html(read(dist, '404.html'))
    expect(doc.title).toBe('Page not found — String Utility Belt')
    expect(doc.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('noindex')
    expect(doc.querySelector('link[rel="canonical"]')).toBeNull()
    expect(doc.querySelector('#root h1')?.textContent).toBe('Page not found')
    expect(doc.querySelector('script[type="module"]')?.getAttribute('src')).toBe('/assets/index-abc123.js')
  })

  it('skips manifest posts that have no markdown or an unsafe slug — no dead URLs anywhere', () => {
    expect(existsSync(path.join(dist, 'blog', 'no-markdown-file'))).toBe(false)
    expect(existsSync(path.join(dist, '..', 'escape'))).toBe(false)
    expect(logs.some(l => l.includes('no-markdown-file'))).toBe(true)
    for (const file of ['sitemap.xml', 'rss.xml', 'blog/index.html']) {
      expect(read(dist, file), file).not.toContain('no-markdown-file')
      expect(read(dist, file), file).not.toContain('Traversal')
      expect(read(dist, file), file).not.toContain('../')
    }
  })

  it('renders each blog post title once (the body’s repeated "# Title" is dropped)', () => {
    const doc = html(read(dist, 'blog/md5-insecure-but-useful/index.html'))
    expect(doc.querySelectorAll('#root h1')).toHaveLength(1)
    expect(doc.querySelector('meta[property="og:type"]')?.getAttribute('content')).toBe('article')
  })

  it('marks blog posts up as BlogPosting with their dates', () => {
    const doc = html(read(dist, 'blog/md5-insecure-but-useful/index.html'))
    const ld = [...doc.querySelectorAll('script[type="application/ld+json"]')].map(s => JSON.parse(s.textContent!))
    expect(ld.map(d => d['@type'])).toEqual(['BlogPosting', 'BreadcrumbList'])
    expect(ld[0]).toMatchObject({ datePublished: '2025-09-18', url: `${SITE}/blog/md5-insecure-but-useful/` })
    expect(ld[0].headline).toBe(doc.querySelector('#root h1')?.textContent)
    expect(doc.querySelector('meta[property="article:published_time"]')?.getAttribute('content')).toBe('2025-09-18')
  })

  it('pre-renders the changelog with real lists', () => {
    const doc = html(read(dist, 'changelog/index.html'))
    expect([...doc.querySelectorAll('#root h1')].map(h => h.textContent)).toEqual(['Changelog'])
    expect(doc.querySelectorAll('#root li').length).toBeGreaterThanOrEqual(5)
    expect(doc.querySelector('#root h2')?.textContent).toBe('Unreleased')
  })

  it('writes a well-formed sitemap listing every published page', () => {
    const doc = xml(read(dist, 'sitemap.xml'))
    const locs = [...doc.getElementsByTagName('loc')].map(l => l.textContent)
    expect(locs).toHaveLength(result.sitemapUrls)
    expect(locs).toEqual(expect.arrayContaining([
      `${SITE}/`, `${SITE}/docs/`, `${SITE}/utilities/`, `${SITE}/util/trim/`, `${SITE}/blog/`,
      `${SITE}/blog/md5-insecure-but-useful/`, `${SITE}/changelog/`,
      `${SITE}/about/`, `${SITE}/privacy/`, `${SITE}/contact/`, `${SITE}/integrations/`,
    ]))
    // every page `pages` counts but the 404, plus the home page (written apart from the count)
    expect(locs).toHaveLength(result.pages - 1 + 1)
    expect(locs).not.toContain(`${SITE}/404.html`)
    expect(locs.filter(l => l?.startsWith(`${SITE}/util/`))).toHaveLength(MANIFEST.length)
    const lastmods = [...doc.getElementsByTagName('lastmod')].map(l => l.textContent)
    expect(lastmods.every(d => /^\d{4}-\d{2}-\d{2}$/.test(d ?? '') && d !== '1970-01-01')).toBe(true)
  })

  it('writes a well-formed RSS feed: posts and releases, dated newest first, no invented dates', () => {
    const doc = xml(read(dist, 'rss.xml'))
    const items = [...doc.getElementsByTagName('item')].map(item => ({
      title: item.getElementsByTagName('title')[0].textContent,
      pubDate: item.getElementsByTagName('pubDate')[0]?.textContent,
      guid: item.getElementsByTagName('guid')[0].textContent,
    }))
    const shipped: Array<{ title: string }> = JSON.parse(read(ROOT, 'public/blog/_manifest.json'))
    expect(items.map(i => i.title)).toEqual([
      'Unreleased changes',
      ...shipped.map(p => p.title),
      'Release 1.3.0',
    ])
    expect(items[0].pubDate).toBe(NOW.toUTCString().replace(/\d\d:\d\d:\d\d/, '00:00:00'))
    // undated release: no pubDate rather than the build date or the epoch
    expect(items[3].pubDate).toBeUndefined()
    expect(items[3].guid).toBe('tag:stringutilitybelt.com,2025:changelog/1.3.0')
  })

  it('is idempotent: a second run over its own output changes nothing', async () => {
    const files = ['index.html', 'util/trim/index.html', 'changelog/index.html', 'docs/index.html', 'sitemap.xml', 'rss.xml']
    const before = files.map(f => read(dist, f))
    await buildSeo({ outDir: dist, root: ROOT, og: false, now: NOW, log: silent })
    const after = files.map(f => read(dist, f))
    expect(after).toEqual(before)
    expect(html(after[1]).querySelectorAll('link[rel="canonical"]')).toHaveLength(1)
  }, 60000)
})

describe('buildSeo with hostile utility metadata', () => {
  it('escapes every interpolation: no injected element, JSON-LD still parses, $-patterns kept literally', async () => {
    const dist = fixtureDist()
    const evil: UtilityMeta = {
      ...MANIFEST.find(m => m.id === 'trim')!,
      id: 'evil_util',
      name: XSS,
      description: XSS,
      category: XSS,
    }
    await buildSeo({ outDir: dist, root: ROOT, og: false, now: NOW, log: silent, manifest: [evil], examples: { evil_util: [{ title: XSS, input: XSS, output: XSS }] } })
    for (const rel of ['util/evil_util/index.html', 'utilities/index.html']) {
      const source = read(dist, rel)
      expect(source, rel).not.toContain('<script>alert(1)</script>')
      const doc = html(source)
      // only the template's module script and the JSON-LD blocks
      expect([...doc.querySelectorAll('script')].every(s => s.type === 'module' || s.type === 'application/ld+json'), rel).toBe(true)
    }
    const doc = html(read(dist, 'util/evil_util/index.html'))
    expect(doc.title).toBe(`${XSS} — String Utility Belt`)
    expect(doc.querySelector('meta[property="og:title"]')?.getAttribute('content')).toBe(`${XSS} — String Utility Belt`)
    expect(doc.querySelector('#root h1')?.textContent).toBe(XSS)
    expect(doc.querySelector('#root pre')?.textContent).toBe(XSS)
    const ld = [...doc.querySelectorAll('script[type="application/ld+json"]')].map(s => JSON.parse(s.textContent!))
    expect(ld[0].description).toBe(XSS)
    xml(read(dist, 'sitemap.xml'))
  }, 60000)

  it('refuses a utility id that is not a safe path segment', async () => {
    const dist = fixtureDist()
    const bad = { ...MANIFEST[0], id: '../../pwned' }
    await expect(buildSeo({ outDir: dist, root: ROOT, og: false, log: silent, manifest: [bad] })).rejects.toThrow(/not safe/)
  })
})

describe('buildSeo edge cases', () => {
  it('fails loudly when dist/index.html is missing (vite build not run)', async () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'build-seo-empty-'))
    tmpDirs.push(dir)
    await expect(buildSeo({ outDir: dir, root: ROOT, og: false, log: silent })).rejects.toThrow(/vite build/)
  })

  it('renders an OG image per utility plus the default card', async () => {
    const dist = fixtureDist()
    const manifest = MANIFEST.filter(m => m.id === 'trim' || m.id === 'tabs_spaces')
    const result = await buildSeo({ outDir: dist, root: ROOT, now: NOW, log: silent, manifest })
    expect(readdirSync(path.join(dist, 'og')).sort()).toEqual(['default.png', 'tabs_spaces.png', 'trim.png'])
    for (const file of readdirSync(path.join(dist, 'og'))) {
      expect([...readFileSync(path.join(dist, 'og', file)).subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    }
    expect(result.ogImages).toBe(3)
    expect(result.missingGlyphs).toEqual([])
  }, 60000)
})

describe('resolveOg', () => {
  it('renders OG images by default, never with --no-og, and with --og-if-workers-ci only in Workers Builds', () => {
    expect(resolveOg([], {})).toBe(true)
    expect(resolveOg(['--', '--no-og'], { WORKERS_CI: '1' })).toBe(false)
    // npm run build's postbuild: fast locally and in GitHub CI, complete in the production deploy
    expect(resolveOg(['--', '--og-if-workers-ci'], {})).toBe(false)
    expect(resolveOg(['--', '--og-if-workers-ci'], { CI: 'true' })).toBe(false)
    expect(resolveOg(['--', '--og-if-workers-ci'], { WORKERS_CI: '1' })).toBe(true)
  })
})

describe('resolveOutDir', () => {
  const root = path.resolve('/repo')
  it('reads --outDir <dir>, --outDir=<dir>, then SEO_OUT_DIR, then dist', () => {
    expect(resolveOutDir(['--outDir', 'out'], {}, root)).toBe(path.join(root, 'out'))
    expect(resolveOutDir(['--', '--outDir=out2'], {}, root)).toBe(path.join(root, 'out2'))
    expect(resolveOutDir([], { SEO_OUT_DIR: 'envdir' }, root)).toBe(path.join(root, 'envdir'))
    expect(resolveOutDir([], {}, root)).toBe(path.join(root, 'dist'))
    const abs = path.resolve('/abs/out')
    expect(resolveOutDir(['--outDir', abs], {}, root)).toBe(abs)
  })
})
