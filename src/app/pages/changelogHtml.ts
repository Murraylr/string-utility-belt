import { mdToHtml } from '@/lib/markdown'

const FENCE = /^\s*```/
/** `[1.3.0]: https://…` — Keep a Changelog's compare-link footer. */
const LINK_REFERENCE = /^ {0,3}\[[^\]\n]+\]:[ \t]*\S+.*$/
/** `## [1.3.0] - 2025-09-27` — the version label is a link reference in KaC. */
const BRACKETED_HEADING = /^(#{1,6}[ \t]+)\[([^\]\n]+)\]/

const PARAGRAPH = /<p class="md-p">([\s\S]*?)<\/p>/g
const BULLET = '- '
const UL_OPEN = '<ul class="md-ul list-disc pl-6 mb-4 grid gap-2 marker:text-muted">'
// exact match only: `md-code-block` (fenced blocks, already scrollable via its `.md-pre`
// ancestor) must not pick this up — only bare inline `` `code` `` spans
const INLINE_CODE_CLASS = /class="md-code"/g

/** Source-level fixes for the Keep a Changelog syntax `mdToHtml` has no rule for. */
function preprocess(md: string): string {
  let inFence = false
  const out: string[] = []
  for (const line of md.replace(/\r\n?/g, '\n').split('\n')) {
    if (FENCE.test(line)) inFence = !inFence
    else if (!inFence && LINK_REFERENCE.test(line)) continue
    out.push(inFence ? line : line.replace(BRACKETED_HEADING, (_, hashes: string, label: string) => hashes + label))
  }
  return out.join('\n')
}

/**
 * `mdToHtml` has no list rule, so bullets arrive as one paragraph whose lines
 * start with `- `. Those lines (already escaped and inline-rendered by
 * `mdToHtml`) are regrouped into `<li>`s — only trusted tags are added — and
 * lists split by blank lines are merged back into one.
 */
function listify(html: string): string {
  return html
    .replace(PARAGRAPH, (whole, inner: string) => {
      const lines = inner.split('\n')
      const start = lines.findIndex(line => line.startsWith(BULLET))
      if (start === -1) return whole
      const items: string[][] = []
      for (const line of lines.slice(start)) {
        if (line.startsWith(BULLET)) items.push([line.slice(BULLET.length)])
        else items[items.length - 1].push(line)
      }
      const lead = start > 0 ? `<p class="md-p">${lines.slice(0, start).join('\n')}</p>\n` : ''
      // min-w-0: the list is `grid` (for `gap-2` between items), which makes each <li> a
      // grid item — without it, a long inline code span (already `break-words`) blows the
      // item past the track width instead of wrapping within it, same as any other grid
      // item whose default `min-width:auto` defers to its content's min-content size
      return `${lead}${UL_OPEN}${items.map(item => `<li class="md-li min-w-0">${item.join('\n')}</li>`).join('')}</ul>`
    })
    .split(`</ul>\n${UL_OPEN}`).join('')
}

/**
 * CHANGELOG.md → HTML through the escaping-safe `mdToHtml`, plus the two
 * Keep a Changelog constructs it lacks: bullet lists, and `[version]`
 * headings with their link-reference footer. Shared by `ChangelogPage` and
 * the pre-rendered `/changelog/` page (`scripts/build-seo.ts`).
 */
export function renderChangelogHtml(md: string): string {
  const html = listify(mdToHtml(preprocess(String(md))))
  // Unlike a fenced block (`.md-pre` already scrolls horizontally), an inline `` `code` ``
  // span sits inside ordinary wrapping text — a long unbroken token (a file path, an
  // identifier) would otherwise force this narrow article wider than the viewport.
  return html.replace(INLINE_CODE_CLASS, 'class="md-code break-words"')
}
