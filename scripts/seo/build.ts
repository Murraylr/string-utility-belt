import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import path from 'node:path'
import type { UtilityMeta } from '../../src/core/registry'
import type { UtilityExample } from '../../src/types/utility'
import { MANIFEST } from '../../src/utilities/_generated/manifest'
import { EXAMPLES } from '../../src/utilities/_generated/examples'
// .js extension: the plain-JS markdown renderer shared with the app's blog
// components (`src/components/BlogPost.tsx`) — not duplicated here
import { mdToHtml, parseFrontmatter } from '../../src/lib/markdown.js'
import { renderChangelogHtml } from '../../src/app/pages/changelogHtml'
import {
  setTitle, setMetaDescription, extractMetaDescription, injectSeoHead, stripSeoHead,
  setRootContent, jsonLdScript, seoMetaTags, rssLinkTag,
} from './html'
import { buildSitemap, buildRss, toIsoDate, type SitemapUrl, type RssItem } from './xml'
import { readBlogManifest, readBlogPostSource, dropRepeatedTitle, isSafeSlug, type BlogPostMeta } from './blog'
import { parseChangelog, summarizeMarkdown, type ChangelogRelease } from './changelog'
import {
  renderUtilityContent, renderUtilitiesIndexContent, renderBlogIndexContent,
  renderBlogPostContent, renderChangelogContent,
} from './content'
import { loadOgFonts, renderOgPng, runPool } from './og'

export const SITE = 'https://stringutilitybelt.com'
const SITE_HOST = new URL(SITE).host
const DEFAULT_OG = `${SITE}/og/default.png`
const SITE_NAME = 'String Utility Belt'

export interface BuildSeoOptions {
  /** The `vite build` output directory; must already contain `index.html`. */
  outDir: string
  /** Repo root — where `CHANGELOG.md` lives. */
  root: string
  /** Render the Open Graph PNGs (default true; ~0.4s each). */
  og?: boolean
  ogConcurrency?: number
  /** Build timestamp for undated sitemap entries (default: now). */
  now?: Date
  log?: (message: string) => void
  /** Utilities to publish (default: the generated manifest + examples). */
  manifest?: UtilityMeta[]
  examples?: Record<string, UtilityExample[]>
}

export interface BuildSeoResult {
  pages: number
  ogImages: number
  sitemapUrls: number
  rssItems: number
  htmlMs: number
  ogMs: number
  /** Characters some OG card needed but no OG font could draw. */
  missingGlyphs: string[]
}

/** `YYYY-MM-DD` / ISO strings only: anything else would render as an invented epoch date. */
const validDate = (value: string | undefined): string | undefined =>
  value && !Number.isNaN(new Date(value).getTime()) ? value : undefined

function writeOut(outDir: string, relPath: string, contents: string | Uint8Array): void {
  const file = path.join(outDir, relPath)
  mkdirSync(path.dirname(file), { recursive: true })
  writeFileSync(file, contents)
}

// ---------------------------------------------------------------------------
// JSON-LD
// ---------------------------------------------------------------------------

function webApplicationLd(meta: UtilityMeta, url: string, description: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: meta.name,
    applicationCategory: 'UtilitiesApplication',
    operatingSystem: 'Any',
    url,
    description,
    isPartOf: { '@type': 'WebSite', name: SITE_NAME, url: `${SITE}/` },
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  }
}

function breadcrumbLd(items: Array<{ name: string; url: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, item: it.url })),
  }
}

// ---------------------------------------------------------------------------
// Page builders — each starts from the built `index.html` template (with any
// earlier run's SEO block already stripped)
// ---------------------------------------------------------------------------

interface PageSpec {
  title: string
  description: string
  canonical: string
  ogImage: string
  ogType?: 'website' | 'article'
  jsonLd?: unknown[]
  content: string
}

function buildPage(template: string, page: PageSpec): string {
  let html = setTitle(template, page.title)
  html = setMetaDescription(html, page.description)
  const head = [
    seoMetaTags({ title: page.title, description: page.description, canonical: page.canonical, ogImage: page.ogImage, ogType: page.ogType }),
    ...(page.jsonLd ?? []).map(jsonLdScript),
  ]
  html = injectSeoHead(html, head.join('\n'))
  return setRootContent(html, page.content)
}

function utilPage(template: string, meta: UtilityMeta, examples: UtilityExample[]): string {
  const title = `${meta.name} — ${SITE_NAME}`
  const description = meta.description || `${meta.name} — a ${SITE_NAME} utility.`
  const canonical = `${SITE}/util/${meta.id}/`
  return buildPage(template, {
    title,
    description,
    canonical,
    ogImage: `${SITE}/og/${meta.id}.png`,
    jsonLd: [
      webApplicationLd(meta, canonical, description),
      breadcrumbLd([
        { name: 'Home', url: `${SITE}/` },
        { name: 'Utilities', url: `${SITE}/utilities/` },
        { name: meta.name, url: canonical },
      ]),
    ],
    content: renderUtilityContent(meta, examples),
  })
}

export interface PublishedPost {
  meta: BlogPostMeta
  title: string
  description: string
  date?: string
  bodyHtml: string
}

/** Posts whose markdown exists, with frontmatter merged over the manifest entry. */
function loadPosts(blogDir: string, log: (m: string) => void): PublishedPost[] {
  const posts: PublishedPost[] = []
  for (const meta of readBlogManifest(blogDir)) {
    const source = readBlogPostSource(blogDir, meta.slug)
    if (source === null) {
      // listing it would put a dead URL in the sitemap, feed and blog index
      log(`[build-seo] warning: blog manifest lists "${meta.slug}" but ${meta.slug}.md is missing — skipped`)
      continue
    }
    const { frontmatter, body } = parseFrontmatter(source) as { frontmatter: Record<string, string>; body: string }
    const title = frontmatter.title || meta.title
    posts.push({
      meta,
      title,
      description: frontmatter.description || meta.description || title,
      date: validDate(frontmatter.date) ?? validDate(meta.date),
      bodyHtml: mdToHtml(dropRepeatedTitle(body, title)),
    })
  }
  return posts
}

/** Blog posts plus one item per changelog release; dated items newest first, undated after. */
export function buildRssItems(posts: PublishedPost[], releases: ChangelogRelease[], buildDate: string): RssItem[] {
  const items: RssItem[] = [
    ...posts.map(p => ({
      title: p.title,
      link: `${SITE}/blog/${p.meta.slug}/`,
      description: p.description,
      pubDate: p.date,
    })),
    ...releases.map(r => {
      const unreleased = r.version.toLowerCase() === 'unreleased'
      return {
        title: unreleased ? 'Unreleased changes' : `Release ${r.version}`,
        link: `${SITE}/changelog/`,
        description: summarizeMarkdown(r.bodyMd) || `${SITE_NAME} ${r.version}`,
        // the unreleased section is what is live right now; a versioned
        // release without a date gets no date rather than an invented one
        pubDate: validDate(r.date) ?? (unreleased ? buildDate : undefined),
        // not a URL: a `#fragment` on the changelog link would be read as an
        // app route by the hash router
        guid: `tag:${SITE_HOST},2025:changelog/${encodeURIComponent(r.version)}`,
      }
    }),
  ]
  const time = (item: RssItem) => (item.pubDate === undefined ? -Infinity : new Date(item.pubDate).getTime())
  return items.sort((a, b) => time(b) - time(a))
}

// ---------------------------------------------------------------------------
// Build
// ---------------------------------------------------------------------------

/**
 * The post-`vite build` SEO pass over `outDir`: pre-rendered pages for every
 * utility, the utilities index, the blog and the changelog; `sitemap.xml`,
 * `rss.xml`; RSS/canonical/OG tags on the home page; and OG images.
 * Idempotent — re-running over its own output rewrites the same files.
 */
export async function buildSeo(options: BuildSeoOptions): Promise<BuildSeoResult> {
  const { outDir, root, og = true, ogConcurrency = 4, log = console.log } = options
  const manifest = options.manifest ?? MANIFEST
  const examples = options.examples ?? EXAMPLES
  const t0 = Date.now()

  const indexHtmlPath = path.join(outDir, 'index.html')
  if (!existsSync(indexHtmlPath)) {
    throw new Error(`[build-seo] ${indexHtmlPath} not found — run \`vite build\` first (or pass --outDir).`)
  }
  for (const meta of manifest) {
    if (!isSafeSlug(meta.id)) throw new Error(`[build-seo] utility id ${JSON.stringify(meta.id)} is not safe as a path segment`)
  }
  const template = stripSeoHead(readFileSync(indexHtmlPath, 'utf8'))
  const blogDir = path.join(outDir, 'blog')
  const posts = loadPosts(blogDir, log)
  const changelogMd = readFileSync(path.join(root, 'CHANGELOG.md'), 'utf8')
  const releases = parseChangelog(changelogMd)
  let pages = 0
  const emit = (relPath: string, html: string) => {
    writeOut(outDir, relPath, html)
    pages++
  }

  for (const meta of manifest) {
    emit(path.join('util', meta.id, 'index.html'), utilPage(template, meta, examples[meta.id] ?? []))
  }

  emit(path.join('utilities', 'index.html'), buildPage(template, {
    title: `All utilities — ${SITE_NAME}`,
    description: `Browse all ${manifest.length} string utilities in ${SITE_NAME}, grouped by category.`,
    canonical: `${SITE}/utilities/`,
    ogImage: DEFAULT_OG,
    content: renderUtilitiesIndexContent(manifest),
  }))

  emit(path.join('blog', 'index.html'), buildPage(template, {
    title: `Blog — ${SITE_NAME}`,
    description: `Guides and notes on string encoding, hashing and text tools from ${SITE_NAME}.`,
    canonical: `${SITE}/blog/`,
    ogImage: DEFAULT_OG,
    content: renderBlogIndexContent(posts.map(p => ({ ...p.meta, title: p.title, description: p.description, date: p.date }))),
  }))
  for (const post of posts) {
    emit(path.join('blog', post.meta.slug, 'index.html'), buildPage(template, {
      title: `${post.title} — ${SITE_NAME}`,
      description: post.description,
      canonical: `${SITE}/blog/${post.meta.slug}/`,
      ogImage: DEFAULT_OG,
      ogType: 'article',
      content: renderBlogPostContent({ title: post.title, date: post.date }, post.bodyHtml),
    }))
  }

  emit(path.join('changelog', 'index.html'), buildPage(template, {
    title: `Changelog — ${SITE_NAME}`,
    description: `Release history for ${SITE_NAME}.`,
    canonical: `${SITE}/changelog/`,
    ogImage: DEFAULT_OG,
    content: renderChangelogContent(renderChangelogHtml(changelogMd)),
  }))

  // home: RSS discovery + canonical + default OG on the site's own index.html
  const homeDescription = extractMetaDescription(template) || `${SITE_NAME} — chain string utilities into pipelines with live previews.`
  writeOut(outDir, 'index.html', injectSeoHead(template, [
    rssLinkTag(`${SITE}/rss.xml`),
    seoMetaTags({ title: SITE_NAME, description: homeDescription, canonical: `${SITE}/`, ogImage: DEFAULT_OG }),
  ].join('\n')))

  const buildDate = toIsoDate(options.now ?? new Date())
  const changelogLastmod = releases.map(r => validDate(r.date)).find(Boolean) ?? buildDate
  const sitemapUrls: SitemapUrl[] = [
    { loc: `${SITE}/`, lastmod: buildDate },
    { loc: `${SITE}/utilities/`, lastmod: buildDate },
    ...manifest.map(m => ({ loc: `${SITE}/util/${m.id}/`, lastmod: buildDate })),
    { loc: `${SITE}/blog/`, lastmod: buildDate },
    ...posts.map(p => ({ loc: `${SITE}/blog/${p.meta.slug}/`, lastmod: p.date ? toIsoDate(p.date) : buildDate })),
    { loc: `${SITE}/changelog/`, lastmod: changelogLastmod },
  ]
  writeOut(outDir, 'sitemap.xml', buildSitemap(sitemapUrls))

  const rssItems = buildRssItems(posts, releases, buildDate)
  writeOut(outDir, 'rss.xml', buildRss({
    title: SITE_NAME,
    link: `${SITE}/`,
    description: `New blog posts and releases from ${SITE_NAME}.`,
    items: rssItems,
  }))
  const htmlMs = Date.now() - t0

  const ogStart = Date.now()
  const missing = new Set<string>()
  let ogImages = 0
  if (og) {
    const fonts = loadOgFonts()
    const onMissingGlyphs = (segment: string) => { for (const ch of segment) if (ch.trim()) missing.add(ch) }
    const cards = [
      ...manifest.map(m => ({ file: `${m.id}.png`, card: { name: m.name, category: m.category, description: m.description } })),
      {
        file: 'default.png',
        card: { name: SITE_NAME, category: 'Free online tool', description: 'Chain string transformations into visual pipelines with live previews.' },
      },
    ]
    // satori and resvg-wasm are synchronous CPU work on this one thread, so
    // the pool only overlaps file writes — a small limit is enough
    await runPool(cards, ogConcurrency, async ({ file, card }) => {
      writeOut(outDir, path.join('og', file), await renderOgPng(card, fonts, { onMissingGlyphs }))
      ogImages++
    })
    if (missing.size) log(`[build-seo] warning: OG font has no glyph for ${[...missing].join(' ')} — add a mapping in scripts/seo/og.ts ogText()`)
  }
  const ogMs = Date.now() - ogStart

  return { pages, ogImages, sitemapUrls: sitemapUrls.length, rssItems: rssItems.length, htmlMs, ogMs, missingGlyphs: [...missing] }
}
