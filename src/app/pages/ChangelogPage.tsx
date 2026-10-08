import React from 'react'
import { useT } from '@/app/i18n/useT'
import PagePromo from '@/app/sponsors/PagePromo'
import { renderChangelogReleases, type ChangelogReleaseHtml } from './changelogHtml'
import { CHANGELOG_DESCRIPTION, CHANGELOG_TITLE } from './seo'
import { useDocumentMeta } from './useDocumentMeta'
// Vite `?raw` import: the changelog ships as plain markdown text, rendered
// through the same escaping-safe renderer as blog posts.
import changelogMd from '../../../CHANGELOG.md?raw'

// static text: rendered on first view (not at app startup — this module is
// imported eagerly by the shell), then reused on every later render
let releases: ChangelogReleaseHtml[] | undefined
const getReleases = () => (releases ??= renderChangelogReleases(changelogMd))

/** Renders CHANGELOG.md as the app's release history page: one row per release, its version beside its notes. */
export default function ChangelogPage() {
  const { formatDate } = useT()
  // restored on leaving: pages that set no title of their own would otherwise keep this one
  useDocumentMeta(CHANGELOG_TITLE, CHANGELOG_DESCRIPTION)

  return (
    <div className="grid gap-9 max-w-[960px]">
      <header className="grid gap-2 pb-6 border-b">
        <h1 className="page-title">Changelog</h1>
        <p className="page-lead">
          Every release, newest first. The format follows{' '}
          <a className="text-fg underline decoration-acc underline-offset-[3px] hover:text-acc"
            href="https://keepachangelog.com/en/1.1.0/" target="_blank" rel="noopener">Keep a Changelog</a>.
        </p>
      </header>
      {getReleases().map((r, i) => (
        <React.Fragment key={r.version}>
          <section className="grid gap-x-10 gap-y-3 pb-8 border-b sm:grid-cols-[150px_minmax(0,1fr)]">
            <div className="grid gap-1 content-start self-start sm:sticky sm:top-[84px]">
              <h2 className="m-0 font-mono text-xl leading-[26px] font-medium">{r.version}</h2>
              {r.date && (
                <time dateTime={r.date} className="font-mono text-[11.5px] text-muted">{formatDate(r.date, { dateStyle: 'medium' })}</time>
              )}
            </div>
            {/* trusted: renderChangelogHtml escapes every character of the source */}
            <div className="md [&>:first-child]:mt-0" dangerouslySetInnerHTML={{ __html: r.html }} />
          </section>
          {/* one of our own tools after the newest release */}
          {i === 0 && <PagePromo page={{ kind: 'index' }} slot="inline" />}
        </React.Fragment>
      ))}
    </div>
  )
}
