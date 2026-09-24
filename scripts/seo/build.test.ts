import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync, rmSync, copyFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { UtilityMeta } from '../../src/core/registry'
import { MANIFEST } from '../../src/utilities/_generated/manifest'
import { buildSeo, SITE } from './build'
import { resolveOutDir } from '../build-seo'

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

afterAll(() => {
  for (const dir of tmpDirs) rmSync(dir, { recursive: true, force: true })
})

describe('buildSeo over a built dist/', () => {
  let dist: string
  let result: Awaited<ReturnType<typeof buildSeo>>
  const logs: string[] = []

  beforeAll(async () => {
    dist = fixtureDist()
    result = await buildSeo({ outDir: dist, root: ROOT, og: false, now: NOW, log: m => logs.push(m) })
  }, 60000)

  it('writes one crawlable page per utility, plus the index, blog and changelog pages', () => {
    const utilDirs = readdirSync(path.join(dist, 'util'))
    expect(utilDirs.sort()).toEqual(MANIFEST.map(m => m.id).sort())
    for (const rel of ['utilities/index.html', 'blog/index.html', 'changelog/index.html',
      'blog/base64-encode-decode-online/index.html', 'blog/md5-insecure-but-useful/index.html']) {
      expect(existsSync(path.join(dist, rel)), rel).toBe(true)
    }
    expect(result.pages).toBe(MANIFEST.length + 5)
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
      expect(doc.title).toBe(`${meta.name} — String Utility Belt`)
      const canonicals = doc.querySelectorAll('link[rel="canonical"]')
      expect(canonicals, meta.id).toHaveLength(1)
      expect(canonicals[0].getAttribute('href')).toBe(`${SITE}/util/${meta.id}/`)
      expect(doc.querySelector('meta[property="og:image"]')?.getAttribute('content')).toBe(`${SITE}/og/${meta.id}.png`)
      expect(doc.querySelector('meta[name="description"]')?.getAttribute('content')).toBe(meta.description)
      const ld = [...doc.querySelectorAll('script[type="application/ld+json"]')].map(s => JSON.parse(s.textContent!))
      expect(ld.map(d => d['@type'])).toEqual(['WebApplication', 'BreadcrumbList'])
      expect(ld[0].name).toBe(meta.name)
      expect(doc.querySelector('#root h1')?.textContent).toBe(meta.name)
    }
  })

  it('keeps the built app script so React mounts over the static content', () => {
    const doc = html(read(dist, 'util/trim/index.html'))
    expect(doc.querySelector('script[type="module"]')?.getAttribute('src')).toBe('/assets/index-abc123.js')
  })

  it('injects RSS discovery, canonical and default OG into the home page without double-escaping', () => {
    const doc = html(read(dist, 'index.html'))
    expect(doc.querySelector('link[rel="alternate"][type="application/rss+xml"]')?.getAttribute('href')).toBe(`${SITE}/rss.xml`)
    expect(doc.querySelectorAll('link[rel="canonical"]')).toHaveLength(1)
    expect(doc.querySelector('meta[property="og:image"]')?.getAttribute('content')).toBe(`${SITE}/og/default.png`)
    expect(doc.querySelector('meta[property="og:description"]')?.getAttribute('content'))
      .toBe('String Pipeline Workshop & friends — chain elegant string utilities with previews.')
    expect(doc.querySelector('#root')?.innerHTML).toBe('')
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
      `${SITE}/`, `${SITE}/utilities/`, `${SITE}/util/trim/`, `${SITE}/blog/`,
      `${SITE}/blog/md5-insecure-but-useful/`, `${SITE}/changelog/`,
    ]))
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
    expect(items.map(i => i.title)).toEqual([
      'Unreleased changes',
      'How to Encode and Decode Base64 Strings Online (Fast & Free)',
      'Why MD5 Is Insecure (But Still Useful for Developers)',
      'Release 1.3.0',
    ])
    expect(items[0].pubDate).toBe(NOW.toUTCString().replace(/\d\d:\d\d:\d\d/, '00:00:00'))
    // undated release: no pubDate rather than the build date or the epoch
    expect(items[3].pubDate).toBeUndefined()
    expect(items[3].guid).toBe('tag:stringutilitybelt.com,2025:changelog/1.3.0')
  })

  it('is idempotent: a second run over its own output changes nothing', async () => {
    const before = ['index.html', 'util/trim/index.html', 'changelog/index.html', 'sitemap.xml', 'rss.xml'].map(f => read(dist, f))
    await buildSeo({ outDir: dist, root: ROOT, og: false, now: NOW, log: silent })
    const after = ['index.html', 'util/trim/index.html', 'changelog/index.html', 'sitemap.xml', 'rss.xml'].map(f => read(dist, f))
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
