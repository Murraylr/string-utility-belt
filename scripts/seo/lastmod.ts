/**
 * Sitemap `<lastmod>` dates that change only when a page's content does.
 *
 * Google uses `lastmod` only while it stays "consistently and verifiably accurate":
 * stamping every URL with the build date on each deploy teaches it to ignore the
 * field. Git history can't supply the dates at build time (CI and Workers Builds
 * check out shallow clones), so `scripts/seo/lastmod.json` records, per page, a
 * hash of its source files and the date that hash was first seen.
 *
 *   npm run gen   refreshes it (runs automatically before `dev` and `build`);
 *                 `npm test` fails while it is stale, so the dates get committed.
 *
 * `build-seo` reads it: a page whose sources still match the recorded hash gets
 * the recorded date; anything unrecorded or changed since gets the build date.
 */
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

/** Page key → hash of its sources and the `YYYY-MM-DD` that hash was first seen. */
export type ContentDates = Record<string, { hash: string; date: string }>

export const LASTMOD_FILE = path.join('scripts', 'seo', 'lastmod.json')

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

export const utilityKey = (id: string): string => `util/${id}`
export const sitePageKey = (slug: string): string => `page/${slug}`
export const DOCS_KEY = 'docs'

/**
 * The repo-relative source files whose content is each page's main content:
 * a utility's module (metadata, params, examples) and guide; a site page's
 * markdown; the usage guide component. Shared chrome and templates are left
 * out on purpose — a header tweak is not a content change worth a recrawl.
 */
export function pageSources(root: string, utilityIds: readonly string[], sitePages: readonly string[]): Record<string, string[]> {
  const sources: Record<string, string[]> = {}
  for (const id of utilityIds) {
    const dir = path.join('src', 'utilities', id)
    sources[utilityKey(id)] = ['index.ts', 'index.tsx', 'guide.md']
      .map(name => path.join(dir, name))
      .filter(rel => existsSync(path.join(root, rel)))
  }
  for (const slug of sitePages) sources[sitePageKey(slug)] = [path.join('src', 'app', 'pages', 'content', `${slug}.md`)]
  sources[DOCS_KEY] = [path.join('src', 'components', 'Docs.tsx')]
  return sources
}

/**
 * A stable digest of the files' paths and contents. Line endings are normalised
 * so a Windows checkout (autocrlf) hashes the same as the Linux build.
 */
export function hashSources(root: string, files: readonly string[]): string {
  const hash = createHash('sha256')
  for (const rel of files) {
    const posix = rel.split(path.sep).join('/')
    const content = readFileSync(path.join(root, rel), 'utf8').replace(/\r\n/g, '\n')
    hash.update(posix).update('\0').update(content).update('\0')
  }
  return hash.digest('hex').slice(0, 16)
}

export function hashPages(root: string, sources: Record<string, string[]>): Record<string, string> {
  return Object.fromEntries(Object.entries(sources).map(([key, files]) => [key, hashSources(root, files)]))
}

/**
 * Next state of the record: unchanged pages keep their date, new or changed ones
 * get `today`, pages that no longer exist are dropped. Keys are sorted so the
 * committed file diffs cleanly.
 */
export function updateContentDates(previous: ContentDates, hashes: Record<string, string>, today: string): ContentDates {
  if (!ISO_DATE.test(today)) throw new Error(`[lastmod] today must be YYYY-MM-DD, got ${JSON.stringify(today)}`)
  const next: ContentDates = {}
  for (const key of Object.keys(hashes).sort()) {
    const prior = previous[key]
    next[key] = prior && prior.hash === hashes[key] ? prior : { hash: hashes[key], date: today }
  }
  return next
}

/** Keys whose recorded hash is missing or no longer matches, plus recorded keys that no longer exist. */
export function staleKeys(recorded: ContentDates, hashes: Record<string, string>): string[] {
  const stale = Object.keys(hashes).filter(key => recorded[key]?.hash !== hashes[key])
  const removed = Object.keys(recorded).filter(key => !(key in hashes))
  return [...stale, ...removed].sort()
}

/** The recorded date when the page's sources still match, else `fallback`. */
export function lastmodFor(recorded: ContentDates, key: string, hash: string | undefined, fallback: string): string {
  const entry = recorded[key]
  return entry && hash !== undefined && entry.hash === hash && ISO_DATE.test(entry.date) ? entry.date : fallback
}

/** Latest of the given `YYYY-MM-DD` dates (they sort lexically), or `fallback` when there are none. */
export function latestDate(dates: readonly string[], fallback: string): string {
  return dates.reduce((max, d) => (d > max ? d : max), '') || fallback
}

export function readContentDates(root: string): ContentDates {
  const file = path.join(root, LASTMOD_FILE)
  if (!existsSync(file)) return {}
  const parsed: unknown = JSON.parse(readFileSync(file, 'utf8'))
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error(`[lastmod] ${LASTMOD_FILE} must hold a JSON object`)
  return parsed as ContentDates
}

export const serializeContentDates = (dates: ContentDates): string => `${JSON.stringify(dates, null, 2)}\n`

/** Refreshes `lastmod.json`; returns whether the file changed. */
export function writeContentDates(root: string, hashes: Record<string, string>, today: string): boolean {
  const file = path.join(root, LASTMOD_FILE)
  const content = serializeContentDates(updateContentDates(readContentDates(root), hashes, today))
  if (existsSync(file) && readFileSync(file, 'utf8') === content) return false
  writeFileSync(file, content)
  return true
}
