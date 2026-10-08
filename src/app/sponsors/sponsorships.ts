import type { Sponsorship } from './sponsors'

/**
 * Booked sponsorships. To book one: put the logo in `public/sponsors/`, add an entry
 * here, and run `npm test` (`sponsors.test.ts` rejects a missing or unsafe logo, text
 * over 100 characters, a non-https link, and two bookings of the same scope on the
 * same day). Merge it before its `start` day: the app shows it from that day to its
 * `end` day. Pre-rendered pages show whatever was live when they were built (the app
 * replaces them on load), so deploy on the first and the day after the last to keep
 * the static HTML that crawlers see in step.
 *
 * Example:
 *   { id: 'acme-2026-11', scope: 'auth-tokens', name: 'Acme', text: 'Single sign-on for your app in an afternoon.',
 *     url: 'https://acme.example/sso', logo: 'acme.svg', start: '2026-11-01', end: '2026-11-30' }
 */
export const SPONSORSHIPS: readonly Sponsorship[] = []
