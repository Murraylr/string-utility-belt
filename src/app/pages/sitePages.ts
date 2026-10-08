import { parseGuide, renderMarkdownDocument } from './guide'

/** A site page (`src/app/pages/content/<slug>.md`), as the app and the pre-render show it. */
export interface SitePageDoc {
  /** SEO title (frontmatter `title`), before `pageTitle` adds the site name. */
  title: string
  description: string
  /** The body — its own `# heading` included — as trusted HTML. */
  html: string
  /** The `##` sections, in order, as plain text with their anchor ids: the page's table of contents. */
  sections: { id: string; title: string }[]
}

const SECTION_HEADING = /<h([23]) class="md-h\1">([\s\S]*?)<\/h\1>/g

/** `MCP server for <code>AI</code> &amp; agents` → `mcp-server-for-ai-agents` */
export function headingId(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&[#\w]+;/g, ' ')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Gives every `##` / `###` section an `id` from its text, so a link can open a page
 * at a section (`/integrations/#command-line-tool`). Repeated headings get `-2`, `-3`….
 */
function withSectionIds(html: string): string {
  const used = new Map<string, number>()
  return html.replace(SECTION_HEADING, (heading: string, level: string, inner: string) => {
    const base = headingId(inner)
    if (!base) return heading
    const n = (used.get(base) ?? 0) + 1
    used.set(base, n)
    const id = n === 1 ? base : `${base}-${n}`
    return `<h${level} id="${id}" class="md-h${level}">${inner}</h${level}>`
  })
}

const ENTITIES: Record<string, string> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" }
const H2_WITH_ID = /<h2 id="([^"]+)" class="md-h2">([\s\S]*?)<\/h2>/g

/** The text of the `##` headings `withSectionIds` gave an id, undoing `escapeHtml`'s entities. */
function sectionsOf(html: string): SitePageDoc['sections'] {
  return [...html.matchAll(H2_WITH_ID)].map(([, id, inner]) => ({
    id,
    title: inner.replace(/<[^>]*>/g, '').replace(/&(?:amp|lt|gt|quot|#39);/g, e => ENTITIES[e]).trim(),
  }))
}

/**
 * Frontmatter `title` and `description`, then markdown in the guide syntax
 * (lists, tables, links) whose `#` line is the page's `<h1>`.
 */
export function parseSitePage(source: string): SitePageDoc {
  const { title = '', description = '' } = parseGuide(source)
  const html = withSectionIds(renderMarkdownDocument(source))
  return { title, description, html, sections: sectionsOf(html) }
}
