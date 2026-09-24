/** Escapes text for XML element content and quoted attribute values. */
export function escapeXml(value: unknown): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/** RFC-822 date string (e.g. `Tue, 23 Sep 2025 00:00:00 GMT`) for RSS `pubDate`. */
export function toRfc822(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return (Number.isNaN(d.getTime()) ? new Date(0) : d).toUTCString()
}

/** `YYYY-MM-DD` for sitemap `<lastmod>`. */
export function toIsoDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return (Number.isNaN(d.getTime()) ? new Date(0) : d).toISOString().slice(0, 10)
}

export interface SitemapUrl {
  loc: string
  lastmod?: string
}

/** Builds a well-formed `sitemap.xml` (protocol per https://www.sitemaps.org/protocol.html). */
export function buildSitemap(urls: SitemapUrl[]): string {
  const entries = urls.map(u => {
    const lastmod = u.lastmod ? `\n    <lastmod>${escapeXml(u.lastmod)}</lastmod>` : ''
    return `  <url>\n    <loc>${escapeXml(u.loc)}</loc>${lastmod}\n  </url>`
  }).join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>\n`
}

export interface RssItem {
  title: string
  link: string
  description: string
  /** Omitted from the feed when absent (optional in RSS 2.0) — never invented. */
  pubDate?: string | Date
  guid?: string
}

export interface RssChannel {
  title: string
  link: string
  description: string
  items: RssItem[]
  language?: string
}

/** Builds a well-formed RSS 2.0 feed, newest item first (caller controls ordering). */
export function buildRss(channel: RssChannel): string {
  const items = channel.items.map(item => {
    const guid = item.guid ?? item.link
    const isPermaLink = guid === item.link
    return [
      '  <item>',
      `    <title>${escapeXml(item.title)}</title>`,
      `    <link>${escapeXml(item.link)}</link>`,
      `    <guid isPermaLink="${isPermaLink}">${escapeXml(guid)}</guid>`,
      ...(item.pubDate !== undefined ? [`    <pubDate>${escapeXml(toRfc822(item.pubDate))}</pubDate>`] : []),
      `    <description>${escapeXml(item.description)}</description>`,
      '  </item>',
    ].join('\n')
  }).join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<rss version="2.0">\n<channel>\n` +
    `  <title>${escapeXml(channel.title)}</title>\n` +
    `  <link>${escapeXml(channel.link)}</link>\n` +
    `  <description>${escapeXml(channel.description)}</description>\n` +
    `  <language>${escapeXml(channel.language ?? 'en-us')}</language>\n` +
    `${items}\n` +
    `</channel>\n</rss>\n`
}
