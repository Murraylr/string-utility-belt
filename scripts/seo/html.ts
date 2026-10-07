/**
 * String-level HTML templating for the prerendered SEO pages. No DOM/parser
 * dependency: every helper only ever *inserts* trusted literal markup around
 * *escaped* dynamic text, so untrusted utility/blog/changelog content can
 * never break out of an attribute or tag.
 *
 * Every insertion goes through a replacer *function*: a string replacement
 * would expand `$&`, `$'`, `` $` `` and `$$` — sequences that real utility
 * examples (regex replace, sed, bcrypt hashes) contain.
 */

/** Escapes text for both HTML element content and quoted attribute values. */
export function escapeHtml(value: unknown): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Alias kept for call-site clarity when the value lands in an attribute. */
export const escapeAttr = escapeHtml

/** Decodes the entities `escapeHtml` (and hand-written HTML attributes) produce. */
export function decodeEntities(value: string): string {
  return value.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (whole, ref: string) => {
    const lower = ref.toLowerCase()
    if (lower === 'amp') return '&'
    if (lower === 'lt') return '<'
    if (lower === 'gt') return '>'
    if (lower === 'quot') return '"'
    if (lower === 'apos') return "'"
    const code = lower.startsWith('#x') ? parseInt(lower.slice(2), 16) : parseInt(lower.slice(1), 10)
    return Number.isFinite(code) && code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : whole
  })
}

// built from a char code rather than written as a backslash-u escape literal,
// which is easy to "normalize" into a bare `<` by accident
const BACKSLASH = String.fromCharCode(92)

/**
 * Serializes a JSON-LD payload for a `<script type="application/ld+json">`
 * body. `<` becomes a JSON unicode escape so a value containing `</script>`
 * cannot terminate the tag early; JSON.stringify already escapes quotes.
 */
export function jsonLdScript(data: unknown): string {
  const json = JSON.stringify(data).replace(/</g, `${BACKSLASH}u003c`)
  return `<script type="application/ld+json">${json}</script>`
}

/**
 * A JSON data block (`<script type="application/json" id="…">`) for the app to read
 * on mount, escaped like `jsonLdScript` so no value can close the tag.
 */
export function jsonDataScript(id: string, data: unknown): string {
  const json = JSON.stringify(data).replace(/</g, `${BACKSLASH}u003c`)
  return `<script type="application/json" id="${escapeAttr(id)}">${json}</script>`
}

/** Replaces the sole `<title>` element (or adds one to `<head>`). */
export function setTitle(html: string, title: string): string {
  const tag = `<title>${escapeHtml(title)}</title>`
  const re = /<title>[\s\S]*?<\/title>/
  return re.test(html) ? html.replace(re, () => tag) : injectHead(html, tag)
}

const META_DESCRIPTION = /<meta\s+name=["']description["'][^>]*>/i

/** Sets (or inserts) `<meta name="description">`. */
export function setMetaDescription(html: string, description: string): string {
  const tag = `<meta name="description" content="${escapeAttr(description)}">`
  return META_DESCRIPTION.test(html) ? html.replace(META_DESCRIPTION, () => tag) : injectHead(html, tag)
}

/** Reads the current `<meta name="description">` content (entity-decoded), if any. */
export function extractMetaDescription(html: string): string | undefined {
  const tag = META_DESCRIPTION.exec(html)?.[0]
  if (!tag) return undefined
  const m = /\scontent=(["'])([\s\S]*?)\1/i.exec(tag)
  return m ? decodeEntities(m[2]) : undefined
}

/** Appends trusted markup right before `</head>`; throws if the template has none. */
export function injectHead(html: string, extraHtml: string): string {
  if (!html.includes('</head>')) throw new Error('[seo] template has no </head> to inject into')
  return html.replace('</head>', () => `${extraHtml}\n</head>`)
}

const SEO_START = '<!-- seo:start -->'
const SEO_END = '<!-- seo:end -->'

/**
 * Like `injectHead`, but fenced in marker comments so `stripSeoHead` can
 * remove it again — a second run over an already-processed `index.html` must
 * not stack a second canonical/OG set onto every page.
 */
export function injectSeoHead(html: string, extraHtml: string): string {
  return injectHead(html, `${SEO_START}\n${extraHtml}\n${SEO_END}`)
}

/** Removes every block `injectSeoHead` added. */
export function stripSeoHead(html: string): string {
  let out = html
  for (;;) {
    const start = out.indexOf(SEO_START)
    const end = start === -1 ? -1 : out.indexOf(SEO_END, start)
    if (end === -1) return out
    // injectHead added the block plus one trailing newline before </head>
    let stop = end + SEO_END.length
    if (out[stop] === '\n') stop++
    out = out.slice(0, start) + out.slice(stop)
  }
}

/** Replaces the empty `<div id="root"></div>` mount point with prerendered content; throws if absent. */
export function setRootContent(html: string, contentHtml: string): string {
  const mount = '<div id="root"></div>'
  if (!html.includes(mount)) throw new Error('[seo] template has no empty <div id="root"></div> mount point')
  return html.replace(mount, () => `<div id="root">${contentHtml}</div>`)
}

const ROOT_START = '<!-- prerender:start -->'
const ROOT_END = '<!-- prerender:end -->'

/**
 * `setRootContent` fenced in marker comments, for the one page a later run reads
 * back as its template (`index.html`): `stripRootContent` empties it again.
 * React's first render clears the comments along with the content.
 */
export function setRemovableRootContent(html: string, contentHtml: string): string {
  return setRootContent(html, `${ROOT_START}${contentHtml}${ROOT_END}`)
}

/** Restores the empty mount point `setRemovableRootContent` filled. */
export function stripRootContent(html: string): string {
  const open = `<div id="root">${ROOT_START}`
  const close = `${ROOT_END}</div>`
  const start = html.indexOf(open)
  const end = start === -1 ? -1 : html.indexOf(close, start)
  if (end === -1) return html
  return `${html.slice(0, start)}<div id="root"></div>${html.slice(end + close.length)}`
}

const META_ROBOTS = /<meta\s+name=["']robots["'][^>]*>/i

/** Sets (or inserts) `<meta name="robots">`. */
export function setRobots(html: string, content: string): string {
  const tag = `<meta name="robots" content="${escapeAttr(content)}">`
  return META_ROBOTS.test(html) ? html.replace(META_ROBOTS, () => tag) : injectHead(html, tag)
}

export interface SeoMetaOptions {
  title: string
  description: string
  canonical: string
  ogImage: string
  ogType?: 'website' | 'article'
  /** An article's `article:published_time` / `article:modified_time` (ISO dates). */
  published?: string
  modified?: string
}

/** Canonical link + Open Graph + Twitter card tags, all escaped. */
export function seoMetaTags(opts: SeoMetaOptions): string {
  const title = escapeHtml(opts.title)
  const description = escapeHtml(opts.description)
  const canonical = escapeAttr(opts.canonical)
  const image = escapeAttr(opts.ogImage)
  return [
    `<link rel="canonical" href="${canonical}">`,
    `<meta property="og:type" content="${opts.ogType ?? 'website'}">`,
    `<meta property="og:site_name" content="String Utility Belt">`,
    `<meta property="og:locale" content="en_US">`,
    `<meta property="og:title" content="${title}">`,
    `<meta property="og:description" content="${description}">`,
    `<meta property="og:url" content="${canonical}">`,
    `<meta property="og:image" content="${image}">`,
    `<meta property="og:image:width" content="1200">`,
    `<meta property="og:image:height" content="630">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${title}">`,
    `<meta name="twitter:description" content="${description}">`,
    `<meta name="twitter:image" content="${image}">`,
    ...(opts.published ? [`<meta property="article:published_time" content="${escapeAttr(opts.published)}">`] : []),
    ...(opts.modified ? [`<meta property="article:modified_time" content="${escapeAttr(opts.modified)}">`] : []),
  ].join('\n')
}

/** `<link rel="alternate" type="application/rss+xml">` for the site-wide feed. */
export function rssLinkTag(rssUrl: string): string {
  return `<link rel="alternate" type="application/rss+xml" title="String Utility Belt" href="${escapeAttr(rssUrl)}">`
}
