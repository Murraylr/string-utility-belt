import { parseGuide, renderMarkdownDocument } from './guide'

/** A site page (`src/app/pages/content/<slug>.md`), as the app and the pre-render show it. */
export interface SitePageDoc {
  /** SEO title (frontmatter `title`), before `pageTitle` adds the site name. */
  title: string
  description: string
  /** The body — its own `# heading` included — as trusted HTML. */
  html: string
}

/**
 * Frontmatter `title` and `description`, then markdown in the guide syntax
 * (lists, tables, links) whose `#` line is the page's `<h1>`.
 */
export function parseSitePage(source: string): SitePageDoc {
  const { title = '', description = '' } = parseGuide(source)
  return { title, description, html: renderMarkdownDocument(source) }
}
