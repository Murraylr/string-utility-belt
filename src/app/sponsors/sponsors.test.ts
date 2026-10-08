import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { MANIFEST } from '@/utilities/_generated/manifest'
import { RECIPE_INDEX } from '@/recipes/_generated/index'
import { sponsorshipProblems } from './check'
import { MAX_SPONSOR_NAME, MAX_SPONSOR_TEXT, pageKey, sponsorFor, sponsoredHref, topicOf, utcDay, type Sponsorship } from './sponsors'
import { SPONSORSHIPS } from './sponsorships'
import { SPONSOR_TOPICS } from './topics'
import { PROMOS } from './promos'
import { CHROME_WEB_STORE_URL, VSCODE_MARKETPLACE_URL } from '@/app/integrations/links'

const booking = (over: Partial<Sponsorship> = {}): Sponsorship => ({
  id: 'acme-2026-11', scope: 'auth-tokens', name: 'Acme', text: 'Single sign-on in an afternoon.',
  url: 'https://acme.example/sso?ref=x', logo: 'acme.svg', start: '2026-11-01', end: '2026-11-30', ...over,
})
const site = booking({ id: 'wide-2026-11', scope: 'site', name: 'Wide' })

describe('topics', () => {
  it('name only real utilities and recipes, each in at most one topic', () => {
    const utilities = new Set(MANIFEST.map(m => m.id))
    const recipes = new Set(RECIPE_INDEX.map(r => r.slug))
    const seen = new Map<string, string>()
    for (const [topic, t] of Object.entries(SPONSOR_TOPICS)) {
      for (const id of t.utilities) {
        expect(utilities.has(id), `${topic}: ${id}`).toBe(true)
        expect(seen.get(`u:${id}`), `${id} is in two topics`).toBeUndefined()
        seen.set(`u:${id}`, topic)
      }
      for (const slug of t.recipes) {
        expect(recipes.has(slug), `${topic}: ${slug}`).toBe(true)
        expect(seen.get(`r:${slug}`), `${slug} is in two topics`).toBeUndefined()
        seen.set(`r:${slug}`, topic)
      }
    }
  })

  it('places a page in its topic; blog posts and other pages in none', () => {
    expect(topicOf({ kind: 'utility', id: 'jwt_decode' })).toBe('auth-tokens')
    expect(topicOf({ kind: 'recipe', slug: 'decode-kubernetes-secret' })).toBe('kubernetes-cloud')
    expect(topicOf({ kind: 'utility', id: 'trim' })).toBeUndefined()
    expect(topicOf({ kind: 'blog', slug: 'md5-insecure-but-useful' })).toBeUndefined()
  })
})

describe('sponsorFor', () => {
  const jwt = { kind: 'utility', id: 'jwt_decode' } as const
  const trim = { kind: 'utility', id: 'trim' } as const

  it('prefers the topic sponsor, falls back to the site-wide one, else none', () => {
    expect(sponsorFor(jwt, '2026-11-10', [site, booking()])?.id).toBe('acme-2026-11')
    expect(sponsorFor(trim, '2026-11-10', [site, booking()])?.id).toBe('wide-2026-11')
    expect(sponsorFor(trim, '2026-11-10', [booking()])).toBeUndefined()
    expect(sponsorFor({ kind: 'blog', slug: 'x' }, '2026-11-10', [booking(), site])?.id).toBe('wide-2026-11')
  })

  it('shows a booking from its first to its last day, inclusive', () => {
    expect(sponsorFor(jwt, '2026-10-31', [booking()])).toBeUndefined()
    expect(sponsorFor(jwt, '2026-11-01', [booking()])?.id).toBe('acme-2026-11')
    expect(sponsorFor(jwt, '2026-11-30', [booking()])?.id).toBe('acme-2026-11')
    expect(sponsorFor(jwt, '2026-12-01', [booking()])).toBeUndefined()
  })

  it('compares UTC days', () => {
    expect(utcDay(new Date('2026-11-30T23:59:59Z'))).toBe('2026-11-30')
    expect(utcDay(new Date('2026-12-01T00:00:00Z'))).toBe('2026-12-01')
  })
})

describe('sponsoredHref', () => {
  it('adds our UTM parameters, keeps the sponsor’s own, and replaces any UTM of the same name', () => {
    const href = new URL(sponsoredHref(booking({ url: 'https://acme.example/sso?ref=x&utm_source=old' }), { kind: 'recipe', slug: 'decode-saml-request' }))
    expect(href.origin + href.pathname).toBe('https://acme.example/sso')
    expect(Object.fromEntries(href.searchParams)).toEqual({
      ref: 'x', utm_source: 'stringutilitybelt', utm_medium: 'sponsorship', utm_campaign: 'acme-2026-11', utm_content: 'recipes/decode-saml-request',
    })
  })

  it('keys pages by their path', () => {
    expect(pageKey({ kind: 'utility', id: 'jwt_decode' })).toBe('util/jwt_decode')
    expect(pageKey({ kind: 'blog', slug: 'md5-insecure-but-useful' })).toBe('blog/md5-insecure-but-useful')
  })
})

describe('bookings', () => {
  const logos = path.resolve(__dirname, '../../../public/sponsors')
  const readLogo = (file: string) => {
    const p = path.join(logos, file)
    return fs.existsSync(p) ? fs.readFileSync(p) : undefined
  }

  it('every booked sponsorship passes the rules', () => {
    expect(sponsorshipProblems(SPONSORSHIPS, readLogo)).toEqual([])
  })

  const svg = (body: string) => () => new TextEncoder().encode(`<svg xmlns="http://www.w3.org/2000/svg">${body}</svg>`)
  const problems = (s: Sponsorship, logo: (file: string) => Uint8Array | undefined = svg('<rect width="1" height="1"/>')) =>
    sponsorshipProblems([s], logo)

  it('accepts a well-formed booking', () => {
    expect(problems(booking())).toEqual([])
  })

  it('rejects text over 100 characters, a non-https or credentialed link, bad dates and unknown scopes', () => {
    expect(problems(booking({ text: 'x'.repeat(101) }))[0]).toMatch(/text must be one line/)
    expect(problems(booking({ text: 'two\nlines' }))[0]).toMatch(/text must be one line/)
    expect(problems(booking({ url: 'http://acme.example' }))[0]).toMatch(/https/)
    expect(problems(booking({ url: 'javascript:alert(1)' }))[0]).toMatch(/https/)
    expect(problems(booking({ url: 'https://u:p@acme.example' }))[0]).toMatch(/credentials/)
    expect(problems(booking({ start: '2026-12-01' }))[0]).toMatch(/start ≤ end/)
    expect(problems(booking({ end: '2026-02-30' }))[0]).toMatch(/YYYY-MM-DD/)
    expect(problems(booking({ scope: 'nope' as never }))[0]).toMatch(/unknown scope/)
  })

  it('rejects a missing, oversized, oddly named or scripted logo', () => {
    expect(problems(booking(), () => undefined)[0]).toMatch(/does not exist/)
    expect(problems(booking(), () => new Uint8Array(51 * 1024))[0]).toMatch(/over 50 KB/)
    expect(problems(booking({ logo: '../x.svg' }))[0]).toMatch(/file name/)
    expect(problems(booking({ logo: 'x.gif' }))[0]).toMatch(/file name/)
    for (const body of ['<script>alert(1)</script>', '<rect onload="x()"/>', '<image href="https://t.example/p.png"/>',
      '<a xlink:href="javascript:x()"/>', '<foreignObject/>', '<use href="//t.example/s.svg#a"/>']) {
      expect(problems(booking(), svg(body)), body).toEqual([expect.stringMatching(/SVG logo contains/)])
    }
  })

  it('rejects two bookings of the same scope on overlapping days, but not back to back', () => {
    const next = booking({ id: 'acme-2026-12', start: '2026-12-01', end: '2026-12-31' })
    const clash = booking({ id: 'rival-2026-11', start: '2026-11-30', end: '2026-12-15' })
    const logo = svg('')
    expect(sponsorshipProblems([booking(), next, site], logo)).toEqual([])
    expect(sponsorshipProblems([booking(), clash], logo)).toEqual(['sponsorships acme-2026-11 and rival-2026-11 both hold auth-tokens on overlapping days'])
    expect(sponsorshipProblems([booking(), booking()], logo)).toContain('sponsorship acme-2026-11: duplicate id')
  })
})

describe('house promos', () => {
  it('fit the slot a sponsor gets, and link to the store pages', () => {
    for (const [id, p] of Object.entries(PROMOS)) {
      expect(p.text.length, id).toBeLessThanOrEqual(MAX_SPONSOR_TEXT)
      expect(p.name.length, id).toBeLessThanOrEqual(MAX_SPONSOR_NAME)
    }
    expect(PROMOS.chrome.href).toBe(CHROME_WEB_STORE_URL)
    expect(PROMOS.vscode.href).toBe(VSCODE_MARKETPLACE_URL)
  })
})
