import { describe, it, expect } from 'vitest'
import { escapeXml, toRfc822, toIsoDate, buildSitemap, buildRss } from './xml'

function parsesCleanly(xml: string) {
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  const errors = doc.getElementsByTagName('parsererror')
  return errors.length === 0
}

describe('escapeXml', () => {
  it('escapes the five XML-significant characters', () => {
    expect(escapeXml(`& < > " '`)).toBe('&amp; &lt; &gt; &quot; &apos;')
  })
})

describe('toRfc822 / toIsoDate', () => {
  it('formats a valid date', () => {
    expect(toRfc822('2025-09-18')).toContain('2025')
    expect(toIsoDate('2025-09-18T00:00:00Z')).toBe('2025-09-18')
  })

  it('falls back to the epoch for an invalid date rather than throwing', () => {
    expect(() => toRfc822('not a date')).not.toThrow()
    expect(toIsoDate('not a date')).toBe('1970-01-01')
  })
})

describe('buildSitemap', () => {
  it('produces well-formed XML that DOMParser accepts', () => {
    const xml = buildSitemap([
      { loc: 'https://x.com/', lastmod: '2025-09-18' },
      { loc: 'https://x.com/util/trim/' },
    ])
    expect(parsesCleanly(xml)).toBe(true)
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')
    expect(xml.match(/<url>/g)?.length).toBe(2)
  })

  it('escapes a malicious loc so it stays well-formed', () => {
    const xml = buildSitemap([{ loc: 'https://x.com/util/"><evil>&', lastmod: '2025-09-18' }])
    expect(parsesCleanly(xml)).toBe(true)
    expect(xml).not.toContain('<evil>')
  })
})

describe('buildRss', () => {
  it('produces well-formed RSS 2.0 that DOMParser accepts', () => {
    const xml = buildRss({
      title: 'String Utility Belt',
      link: 'https://x.com/',
      description: 'feed',
      items: [
        { title: 'Post A', link: 'https://x.com/blog/a/', description: 'about a', pubDate: '2025-09-18' },
        { title: 'Release 1.3.0', link: 'https://x.com/changelog/', description: 'release notes', pubDate: new Date('2025-01-01') },
      ],
    })
    expect(parsesCleanly(xml)).toBe(true)
    expect(xml).toContain('<rss version="2.0">')
    expect(xml.match(/<item>/g)?.length).toBe(2)
  })

  it('escapes malicious item content and stays well-formed', () => {
    const xml = buildRss({
      title: 'feed',
      link: 'https://x.com/',
      description: 'd',
      items: [{ title: '"><script>alert(1)</script>', link: 'https://x.com/', description: 'x & y', pubDate: '2025-01-01' }],
    })
    expect(parsesCleanly(xml)).toBe(true)
    expect(xml).not.toContain('<script>alert(1)</script>')
  })
})

describe('buildRss without a pubDate', () => {
  it('omits <pubDate> for an undated item (optional in RSS 2.0) instead of inventing one', () => {
    const xml = buildRss({
      title: 'feed',
      link: 'https://x.com/',
      description: 'd',
      items: [
        { title: 'dated', link: 'https://x.com/a/', description: 'a', pubDate: '2025-09-18' },
        { title: 'undated', link: 'https://x.com/changelog/', description: 'b', guid: 'tag:x.com,2025:changelog/1.3.0' },
      ],
    })
    expect(parsesCleanly(xml)).toBe(true)
    const doc = new DOMParser().parseFromString(xml, 'application/xml')
    const items = [...doc.getElementsByTagName('item')]
    expect(items[0].getElementsByTagName('pubDate')).toHaveLength(1)
    expect(items[1].getElementsByTagName('pubDate')).toHaveLength(0)
    expect(items[1].getElementsByTagName('guid')[0].getAttribute('isPermaLink')).toBe('false')
  })
})
