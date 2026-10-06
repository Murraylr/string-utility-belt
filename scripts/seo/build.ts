import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import path from 'node:path'
import type { UtilityMeta } from '../../src/core/registry'
import type { UtilityExample } from '../../src/types/utility'
import { MANIFEST } from '../../src/utilities/_generated/manifest'
import { EXAMPLES } from '../../src/utilities/_generated/examples'
// .js extension: the plain-JS markdown helpers shared with the app's blog
// components (`src/components/BlogPost.tsx`) — not duplicated here
import { parseFrontmatter } from '../../src/lib/markdown.js'
import { SITE_PAGES, type SitePageSlug } from '../../src/lib/router'
import { renderChangelogHtml } from '../../src/app/pages/changelogHtml'
import {
  setTitle, setMetaDescription, injectSeoHead, stripSeoHead, setRootContent, setRemovableRootContent,
  stripRootContent, setRobots, jsonLdScript, seoMetaTags, rssLinkTag,
} from './html'
import { buildSitemap, buildRss, toIsoDate, type SitemapUrl, type RssItem } from './xml'
import { readBlogManifest, readBlogPostSource, dropRepeatedTitle, isSafeSlug, type BlogPostMeta } from './blog'
import { parseChangelog, summarizeMarkdown, type ChangelogRelease } from './changelog'
import {
  renderUtilityContent, renderUtilitiesIndexContent, renderBlogIndexContent, renderBlogPostContent,
  renderChangelogContent, renderHomeContent, renderDocsContent, renderSitePageContent, renderNotFoundContent,
  renderSiteChrome,
} from './content'
import { loadOgFonts, renderOgPng, runPool } from './og'
import { parseGuide, renderGuideHtml, renderMarkdownDocument, type Guide } from '../../src/app/pages/guide'
import { relatedUtilities } from '../../src/app/pages/related'
import { parseSitePage } from '../../src/app/pages/sitePages'
import {
  SITE_NAME, SITE_URL, pageTitle, displayName, HOME_TITLE, homeDescription, utilitiesTitle, utilitiesDescription,
  BLOG_TITLE, BLOG_DESCRIPTION, CHANGELOG_TITLE, CHANGELOG_DESCRIPTION, DOCS_TITLE, DOCS_DESCRIPTION,
} from '../../src/app/pages/seo'

export const SITE = SITE_URL
const SITE_HOST = new URL(SITE).host
const DEFAULT_OG = `${SITE}/og/default.png`
const LOGO = `${SITE}/icons/icon-512.png`

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
  /** Guide markdown by utility id (default: each `src/utilities/<id>/guide.md` under `root`). */
  guides?: Record<string, string>
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

const ORGANIZATION = { '@type': 'Organization', name: SITE_NAME, url: `${SITE}/`, logo: LOGO }
const WEBSITE = { '@type': 'WebSite', name: SITE_NAME, url: `${SITE}/` }
const FREE = { '@type': 'Offer', price: '0', priceCurrency: 'USD' }

/** On the home page only: tells Google the site's name (shown above every result) and publisher. */
function websiteLd(description: string) {
  return { '@context': 'https://schema.org', ...WEBSITE, description, inLanguage: 'en', publisher: ORGANIZATION }
}

function homeApplicationLd(description: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: SITE_NAME,
    url: `${SITE}/`,
    description,
    applicationCategory: 'DeveloperApplication',
    operatingSystem: 'Any',
    browserRequirements: 'Requires JavaScript',
    isAccessibleForFree: true,
    offers: FREE,
  }
}

function webApplicationLd(meta: UtilityMeta, url: string, description: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: displayName(meta.name),
    applicationCategory: 'UtilitiesApplication',
    operatingSystem: 'Any',
    url,
    description,
    isAccessibleForFree: true,
    isPartOf: WEBSITE,
    offers: FREE,
  }
}

/** A page about the site itself (`AboutPage`, `ContactPage`, or a plain `WebPage` such as the privacy policy). */
function webPageLd(type: string, name: string, url: string, description: string) {
  return { '@context': 'https://schema.org', '@type': type, name, url, description, isPartOf: WEBSITE }
}

function blogPostingLd(post: PublishedPost, url: string) {
  const modified = post.updated ?? post.date
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.description,
    url,
    mainEntityOfPage: url,
    image: DEFAULT_OG,
    inLanguage: 'en',
    ...(post.date ? { datePublished: post.date } : {}),
    ...(modified ? { dateModified: modified } : {}),
    author: ORGANIZATION,
    publisher: ORGANIZATION,
    isPartOf: WEBSITE,
  }
}

const HOME_CRUMB = { name: 'Home', url: `${SITE}/` }

function breadcrumbLd(items: Array<{ name: string; url: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, item: it.url })),
  }
}

const SITE_PAGE_TYPES: Record<SitePageSlug, string> = { about: 'AboutPage', privacy: 'WebPage', contact: 'ContactPage', integrations: 'WebPage' }

// ---------------------------------------------------------------------------
// Page builders — each starts from the built `index.html` template (with any
// earlier run's SEO block and home content already stripped)
// ---------------------------------------------------------------------------

interface PageSpec {
  title: string
  description: string
  canonical: string
  ogImage: string
  ogType?: 'website' | 'article'
  published?: string
  modified?: string
  jsonLd?: unknown[]
  content: string
}

function buildPage(template: string, page: PageSpec, year: number): string {
  let html = setTitle(template, page.title)
  html = setMetaDescription(html, page.description)
  const head = [
    seoMetaTags({
      title: page.title, description: page.description, canonical: page.canonical, ogImage: page.ogImage,
      ogType: page.ogType, published: page.published, modified: page.modified,
    }),
    ...(page.jsonLd ?? []).map(jsonLdScript),
  ]
  html = injectSeoHead(html, head.join('\n'))
  return setRootContent(html, renderSiteChrome(page.content, year))
}

/** `src/utilities/<id>/guide.md`, when the utility has one. */
function readGuide(root: string, id: string): string | undefined {
  const file = path.join(root, 'src', 'utilities', id, 'guide.md')
  return existsSync(file) ? readFileSync(file, 'utf8') : undefined
}

function utilPage(meta: UtilityMeta, examples: UtilityExample[], guide: Guide | undefined, related: UtilityMeta[]): PageSpec {
  // the guide's search-facing title/description, as `UtilityDocPage` also sets them
  const name = displayName(meta.name)
  const title = pageTitle(guide?.title ?? name)
  const description = guide?.description || meta.description || `${name} — a ${SITE_NAME} utility.`
  const canonical = `${SITE}/util/${meta.id}/`
  return {
    title,
    description,
    canonical,
    ogImage: `${SITE}/og/${meta.id}.png`,
    jsonLd: [
      webApplicationLd(meta, canonical, description),
      breadcrumbLd([HOME_CRUMB, { name: 'Utilities', url: `${SITE}/utilities/` }, { name, url: canonical }]),
    ],
    content: renderUtilityContent(meta, examples, { guideHtml: guide && renderGuideHtml(guide), related }),
  }
}

export interface PublishedPost {
  meta: BlogPostMeta
  title: string
  description: string
  date?: string
  /** Frontmatter `updated`: the last substantial revision, when later than `date`. */
  updated?: string
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
      updated: validDate(frontmatter.updated),
      // the renderer `BlogPost` uses too: guide syntax (lists, tables) at the post's own heading levels
      bodyHtml: renderMarkdownDocument(dropRepeatedTitle(body, title)),
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
 * utility, the utilities index, the blog, the changelog, the usage guide (`/docs/`)
 * and the site pages (about, privacy, contact); `404.html`; `sitemap.xml`, `rss.xml`; the home
 * page's head and static content; and OG images. Every page's static content
 * sits in the site's header nav and footer. Idempotent — re-running over its
 * own output rewrites the same files.
 */
export async function buildSeo(options: BuildSeoOptions): Promise<BuildSeoResult> {
  const { outDir, root, og = true, ogConcurrency = 4, log = console.log } = options
  const manifest = options.manifest ?? MANIFEST
  const examples = options.examples ?? EXAMPLES
  const now = options.now ?? new Date()
  const year = now.getUTCFullYear()
  const t0 = Date.now()

  const indexHtmlPath = path.join(outDir, 'index.html')
  if (!existsSync(indexHtmlPath)) {
    throw new Error(`[build-seo] ${indexHtmlPath} not found — run \`vite build\` first (or pass --outDir).`)
  }
  for (const meta of manifest) {
    if (!isSafeSlug(meta.id)) throw new Error(`[build-seo] utility id ${JSON.stringify(meta.id)} is not safe as a path segment`)
  }
  // a processed index.html (an earlier run's output) back to the bare `vite build` template
  const template = stripRootContent(stripSeoHead(readFileSync(indexHtmlPath, 'utf8')))
  const blogDir = path.join(outDir, 'blog')
  const posts = loadPosts(blogDir, log)
  const changelogMd = readFileSync(path.join(root, 'CHANGELOG.md'), 'utf8')
  const releases = parseChangelog(changelogMd)
  let pages = 0
  const emit = (relPath: string, html: string) => {
    writeOut(outDir, relPath, html)
    pages++
  }
  const page = (relPath: string, spec: PageSpec) => emit(relPath, buildPage(template, spec, year))

  let guides = 0
  for (const meta of manifest) {
    const source = options.guides ? options.guides[meta.id] : readGuide(root, meta.id)
    const guide = source === undefined ? undefined : parseGuide(source)
    if (guide) guides++
    page(path.join('util', meta.id, 'index.html'), utilPage(meta, examples[meta.id] ?? [], guide, relatedUtilities(meta, manifest)))
  }
  if (guides < manifest.length) log(`[build-seo] warning: ${manifest.length - guides} of ${manifest.length} utilities have no guide.md`)

  const utilitiesUrl = `${SITE}/utilities/`
  page(path.join('utilities', 'index.html'), {
    title: utilitiesTitle(manifest.length),
    description: utilitiesDescription(manifest.length),
    canonical: utilitiesUrl,
    ogImage: DEFAULT_OG,
    jsonLd: [
      webPageLd('CollectionPage', 'All utilities', utilitiesUrl, utilitiesDescription(manifest.length)),
      breadcrumbLd([HOME_CRUMB, { name: 'Utilities', url: utilitiesUrl }]),
    ],
    content: renderUtilitiesIndexContent(manifest),
  })

  const blogUrl = `${SITE}/blog/`
  page(path.join('blog', 'index.html'), {
    title: BLOG_TITLE,
    description: BLOG_DESCRIPTION,
    canonical: blogUrl,
    ogImage: DEFAULT_OG,
    jsonLd: [breadcrumbLd([HOME_CRUMB, { name: 'Blog', url: blogUrl }])],
    content: renderBlogIndexContent(posts.map(p => ({ ...p.meta, title: p.title, description: p.description, date: p.date }))),
  })
  for (const post of posts) {
    const url = `${SITE}/blog/${post.meta.slug}/`
    page(path.join('blog', post.meta.slug, 'index.html'), {
      title: pageTitle(post.title),
      description: post.description,
      canonical: url,
      ogImage: DEFAULT_OG,
      ogType: 'article',
      published: post.date,
      modified: post.updated,
      jsonLd: [
        blogPostingLd(post, url),
        breadcrumbLd([HOME_CRUMB, { name: 'Blog', url: blogUrl }, { name: post.title, url }]),
      ],
      content: renderBlogPostContent({ title: post.title, date: post.date, updated: post.updated }, post.bodyHtml),
    })
  }

  page(path.join('changelog', 'index.html'), {
    title: CHANGELOG_TITLE,
    description: CHANGELOG_DESCRIPTION,
    canonical: `${SITE}/changelog/`,
    ogImage: DEFAULT_OG,
    content: renderChangelogContent(renderChangelogHtml(changelogMd)),
  })

  const docsUrl = `${SITE}/docs/`
  page(path.join('docs', 'index.html'), {
    title: DOCS_TITLE,
    description: DOCS_DESCRIPTION,
    canonical: docsUrl,
    ogImage: DEFAULT_OG,
    jsonLd: [breadcrumbLd([HOME_CRUMB, { name: 'Docs', url: docsUrl }])],
    content: renderDocsContent(),
  })

  for (const slug of SITE_PAGES) {
    const doc = parseSitePage(readFileSync(path.join(root, 'src', 'app', 'pages', 'content', `${slug}.md`), 'utf8'))
    const url = `${SITE}/${slug}/`
    const heading = doc.title.split(' — ')[0]
    page(path.join(slug, 'index.html'), {
      title: pageTitle(doc.title),
      description: doc.description,
      canonical: url,
      ogImage: DEFAULT_OG,
      jsonLd: [
        webPageLd(SITE_PAGE_TYPES[slug], heading, url, doc.description),
        breadcrumbLd([HOME_CRUMB, { name: heading, url }]),
      ],
      content: renderSitePageContent(doc.html),
    })
  }

  // for any path that is not a page, once wrangler.jsonc switches not_found_handling
  // to "404-page"; no canonical, and kept out of the index
  let notFound = setTitle(template, pageTitle('Page not found'))
  notFound = setMetaDescription(notFound, `There is no ${SITE_NAME} page at this address.`)
  notFound = setRobots(notFound, 'noindex')
  emit('404.html', setRootContent(notFound, renderSiteChrome(renderNotFoundContent(), year)))

  // home: title, description, RSS discovery, canonical, default OG, the site's
  // name/publisher for search results, and the popular-tools links as static content
  const homeDesc = homeDescription(manifest.length)
  let home = setMetaDescription(setTitle(template, HOME_TITLE), homeDesc)
  home = injectSeoHead(home, [
    rssLinkTag(`${SITE}/rss.xml`),
    seoMetaTags({ title: HOME_TITLE, description: homeDesc, canonical: `${SITE}/`, ogImage: DEFAULT_OG }),
    jsonLdScript(websiteLd(homeDesc)),
    jsonLdScript(homeApplicationLd(homeDesc)),
  ].join('\n'))
  // removable: this file is the next run's template
  writeOut(outDir, 'index.html', setRemovableRootContent(home, renderSiteChrome(renderHomeContent(manifest), year)))

  const buildDate = toIsoDate(now)
  const changelogLastmod = releases.map(r => validDate(r.date)).find(Boolean) ?? buildDate
  const sitemapUrls: SitemapUrl[] = [
    { loc: `${SITE}/`, lastmod: buildDate },
    { loc: docsUrl, lastmod: buildDate },
    { loc: utilitiesUrl, lastmod: buildDate },
    ...manifest.map(m => ({ loc: `${SITE}/util/${m.id}/`, lastmod: buildDate })),
    { loc: blogUrl, lastmod: buildDate },
    ...posts.map(p => {
      const changed = p.updated ?? p.date
      return { loc: `${SITE}/blog/${p.meta.slug}/`, lastmod: changed ? toIsoDate(changed) : buildDate }
    }),
    { loc: `${SITE}/changelog/`, lastmod: changelogLastmod },
    ...SITE_PAGES.map(slug => ({ loc: `${SITE}/${slug}/`, lastmod: buildDate })),
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
      ...manifest.map(m => ({ file: `${m.id}.png`, card: { name: displayName(m.name), category: m.category, description: m.description } })),
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
