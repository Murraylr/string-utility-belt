/**
 * Direct sponsorship (sold on /advertise/): which sponsor, if any, a content page shows.
 * Pure data and functions — no DOM, no React — so the app and the pre-render
 * (`scripts/seo/build.ts`) pick the same sponsor for the same page and day.
 *
 * Bookings live in `./sponsorships`, topics in `./topics`; `sponsors.test.ts` validates both.
 */
import { SPONSOR_TOPICS, type SponsorTopicId } from './topics'

/** A content page that can carry a sponsor. The tool, embeds and index pages never do. */
export type SponsorPage =
  | { kind: 'utility'; id: string }
  | { kind: 'recipe'; slug: string }
  | { kind: 'blog'; slug: string }

export interface Sponsorship {
  /** Stable booking id, e.g. `acme-2026-11`: the UTM campaign and the analytics `sponsorship_id`. */
  id: string
  /** `site`: every sponsorable page no topic sponsor holds; a topic: that topic's pages only, exclusively. */
  scope: SponsorTopicId | 'site'
  /** The sponsor's name as shown, bold, before the text. */
  name: string
  /** One line of plain text, at most `MAX_SPONSOR_TEXT` characters. */
  text: string
  /** The landing page (https). UTM parameters are added when the link is rendered. */
  url: string
  /** A square logo in `public/sponsors/` (file name only): SVG, PNG or WebP, at most `MAX_LOGO_BYTES`. */
  logo: string
  /** First and last day shown, inclusive, as UTC `YYYY-MM-DD`. */
  start: string
  end: string
}

export const MAX_SPONSOR_TEXT = 100
export const MAX_SPONSOR_NAME = 40
export const MAX_LOGO_BYTES = 50 * 1024
export const LOGO_DIR = '/sponsors/'

/** The UTC calendar day of `date`, as `YYYY-MM-DD` (what `start` and `end` are compared with). */
export const utcDay = (date: Date): string => date.toISOString().slice(0, 10)

/** The page's path without slashes (`util/jwt_decode`): the UTM content and the analytics `sponsor_page`. */
export function pageKey(page: SponsorPage): string {
  if (page.kind === 'utility') return `util/${page.id}`
  if (page.kind === 'recipe') return `recipes/${page.slug}`
  return `blog/${page.slug}`
}

/** The topic a page belongs to; blog posts and pages outside every topic have none. */
export function topicOf(page: SponsorPage): SponsorTopicId | undefined {
  if (page.kind === 'blog') return undefined
  const ids = Object.keys(SPONSOR_TOPICS) as SponsorTopicId[]
  return page.kind === 'utility'
    ? ids.find(t => (SPONSOR_TOPICS[t].utilities as readonly string[]).includes(page.id))
    : ids.find(t => (SPONSOR_TOPICS[t].recipes as readonly string[]).includes(page.slug))
}

const isLive = (s: Sponsorship, day: string) => s.start <= day && day <= s.end

/** The page's sponsor on `day`: its topic's sponsor if the topic is sold, else the site-wide one, else none. */
export function sponsorFor(page: SponsorPage, day: string, sponsorships: readonly Sponsorship[]): Sponsorship | undefined {
  const live = sponsorships.filter(s => isLive(s, day))
  const topic = topicOf(page)
  return (topic && live.find(s => s.scope === topic)) || live.find(s => s.scope === 'site')
}

/** The sponsor's link with our UTM parameters (replacing any of the same name, keeping the rest). */
export function sponsoredHref(s: Sponsorship, page: SponsorPage): string {
  const url = new URL(s.url)
  url.searchParams.set('utm_source', 'stringutilitybelt')
  url.searchParams.set('utm_medium', 'sponsorship')
  url.searchParams.set('utm_campaign', s.id)
  url.searchParams.set('utm_content', pageKey(page))
  return url.toString()
}
