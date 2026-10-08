import { execFileSync } from 'node:child_process'
import { toIsoDate } from './xml'

/**
 * The newest `YYYY-MM-DD` on which any of `paths` changed: repo-relative files, or directories for
 * every file under them. `undefined` when none of them has any history (an uncommitted file).
 */
export type SourceDates = (paths: readonly string[]) => string | undefined

/** The newest of some `YYYY-MM-DD` dates, ignoring missing ones. */
export function newest(dates: ReadonlyArray<string | undefined>): string | undefined {
  let latest: string | undefined
  for (const date of dates) if (date !== undefined && (latest === undefined || date > latest)) latest = date
  return latest
}

/** Tests and snapshots never reach a page, so committing one does not change the page. */
const isRendered = (file: string) => !/\.test\.[^/]+$|(^|\/)__snapshots__\//.test(file)

/** Marks a commit's date in `git log -z` output, where it would otherwise read like a file name. */
const COMMIT_MARK = '\x01'
const LOG_FORMAT = '--format=%x01%cI'

/**
 * Parses `git log -z --name-only --format=%x01%cI` output into the newest change date (UTC
 * `YYYY-MM-DD`) of each file and of each directory above it. Keeps the newest date rather than the
 * first one seen: committer dates are not guaranteed to be in order.
 */
export function parseGitLog(output: string): Map<string, string> {
  const dates = new Map<string, string>()
  let date: string | undefined
  for (const token of output.split('\0')) {
    // `-z` separates a commit's header from its file list with a newline
    const entry = token.startsWith('\n') ? token.slice(1) : token
    if (entry.startsWith(COMMIT_MARK)) {
      const when = entry.slice(COMMIT_MARK.length)
      date = Number.isNaN(Date.parse(when)) ? undefined : toIsoDate(when)
      continue
    }
    if (!entry || date === undefined || !isRendered(entry)) continue
    // the file, then each directory above it; a directory already as new as this commit has
    // ancestors at least as new, so the walk stops there
    for (let p = entry; p; p = p.slice(0, Math.max(p.lastIndexOf('/'), 0))) {
      const seen = dates.get(p)
      if (seen !== undefined && seen >= date) break
      dates.set(p, date)
    }
  }
  return dates
}

export interface ReadSourceDatesOptions {
  /** The date of every path when there is no git at all (not a repository, no commits, no `git`). */
  fallback: string
  log?: (message: string) => void
}

/**
 * Each path's last change on HEAD's first-parent history under `root`, from one `git log` pass. A
 * merge dates every file its branch changed to the day it landed on the main line — when it was
 * deployed — not the day it was written on the branch.
 *
 * A shallow clone (CI's default checkout, Cloudflare Workers Builds) cannot answer: its oldest commit
 * lists every file as added. Then, and without git, every path gets one date — HEAD's commit date, or
 * `fallback` with no commit to read — wrong for most pages, but the same on every build of a commit.
 * Production deploys from a full clone (`fetch-depth: 0` in release.yml).
 */
export function readSourceDates(root: string, { fallback, log = () => {} }: ReadSourceDatesOptions): SourceDates {
  const git = (args: string[]) => execFileSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let date: string
  try {
    if (git(['rev-parse', '--is-shallow-repository']).trim() !== 'true') {
      const dates = parseGitLog(git([
        'log', '-z', '--first-parent', '--diff-merges=first-parent', '--no-renames', '--relative', '--name-only', LOG_FORMAT,
      ]))
      return paths => newest(paths.map(p => dates.get(p.replace(/^\.\//, '').replace(/\/+$/, ''))))
    }
    date = toIsoDate(git(['log', '-1', '--format=%cI']).trim())
    log(`[build-seo] warning: shallow git clone — every git-dated sitemap lastmod is HEAD's commit date (${date}); fetch full history for real dates`)
  } catch (e) {
    date = fallback
    const reason = e instanceof Error ? e.message.split('\n')[0] : String(e)
    log(`[build-seo] warning: no git history (${reason}) — every git-dated sitemap lastmod is ${date}`)
  }
  return () => date
}
