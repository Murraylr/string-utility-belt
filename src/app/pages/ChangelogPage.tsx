import { renderChangelogHtml } from './changelogHtml'
import { CHANGELOG_DESCRIPTION, CHANGELOG_TITLE } from './seo'
import { useDocumentMeta } from './useDocumentMeta'
// Vite `?raw` import: the changelog ships as plain markdown text, rendered
// through the same escaping-safe renderer as blog posts.
import changelogMd from '../../../CHANGELOG.md?raw'

// static text: rendered on first view (not at app startup — this module is
// imported eagerly by the shell), then reused on every later render
let changelogHtml: string | undefined
const getChangelogHtml = () => (changelogHtml ??= renderChangelogHtml(changelogMd))

/** Renders CHANGELOG.md as the app's release history page. */
export default function ChangelogPage() {
  // restored on leaving: pages that set no title of their own would otherwise keep this one
  useDocumentMeta(CHANGELOG_TITLE, CHANGELOG_DESCRIPTION)

  return (
    // w-full + min-w-0: `max-w-3xl mx-auto` alone leaves this grid item's width "auto",
    // which — with a non-wrapping code block inside (.md-pre already scrolls itself) —
    // grid sizes via shrink-to-fit up to the block's min-content width, blowing the article
    // (and the page) wider than the viewport instead of clipping to the grid track
    // the leading `# Changelog` keeps `.md-h1`'s top margin otherwise, a blank band above the title
    <article className="md w-full max-w-3xl mx-auto card p-6 min-w-0 [&>div>:first-child]:mt-0">
      <div dangerouslySetInnerHTML={{ __html: getChangelogHtml() }} />
    </article>
  )
}
