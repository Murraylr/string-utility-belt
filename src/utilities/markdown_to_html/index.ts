import type { Utility } from '@/types/utility'

// `marked` is loaded lazily so it never lands in the app's initial bundle
// (src/utilities/index.ts eagerly globs every utility module). The promise is
// cached, so the pipeline re-running on every keystroke imports it only once.
const loadMarked = () => import('marked')
let _marked: ReturnType<typeof loadMarked> | null = null
const getMarked = () => (_marked ??= loadMarked())

const asBool = (value: unknown, fallback: boolean): boolean => {
  if (value === undefined || value === null || value === '') return fallback
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') return value !== 'false' && value !== '0'
  return Boolean(value)
}

function asText(input: unknown): string {
  if (input === undefined || input === null) return ''
  if (typeof input === 'string') return input
  if (input instanceof Uint8Array) return new TextDecoder().decode(input)
  if (typeof input === 'object') {
    throw new Error('markdown to html expects Markdown text, but received structured data')
  }
  return String(input)
}

const BASIC_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' '
}

/** Reduce a heading's inner HTML to the plain text an anchor slug is built from. */
function headingText(inner: string): string {
  return inner
    .replace(/<[^>]*>/g, '')
    .replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);/g, (whole, ref: string) => {
      if (ref[0] === '#') {
        const cp = ref[1] === 'x' || ref[1] === 'X'
          ? Number.parseInt(ref.slice(2), 16)
          : Number.parseInt(ref.slice(1), 10)
        if (!Number.isFinite(cp) || cp < 0 || cp > 0x10ffff) return whole
        try {
          return String.fromCodePoint(cp)
        } catch {
          return whole
        }
      }
      return BASIC_ENTITIES[ref] ?? whole
    })
}

/** GitHub-flavoured anchor slug: lowercase, punctuation dropped, spaces to hyphens. */
function slugify(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\p{M}\s_-]+/gu, '')
    .replace(/\s+/g, '-')
}

/**
 * `marked` dropped built-in header ids, so add them here: every `<hN>` without
 * attributes gets an `id` derived from its text, de-duplicated GitHub-style.
 */
function addHeaderIds(html: string): string {
  const seen = new Map<string, number>()
  let n = 0
  return html.replace(/<h([1-6])>([\s\S]*?)<\/h\1>/g, (whole, level: string, inner: string) => {
    n += 1
    let slug = slugify(headingText(inner))
    if (!slug) slug = `heading-${n}`
    const used = seen.get(slug) ?? 0
    seen.set(slug, used + 1)
    const id = used === 0 ? slug : `${slug}-${used}`
    return `<h${level} id="${id}">${inner}</h${level}>`
  })
}

const util: Utility = {
  id: 'markdown_to_html',
  name: 'markdown to html',
  category: 'Data Formats',
  description:
    'Render Markdown as HTML, with optional GitHub flavored syntax, hard line breaks, and slug ids on headings.',
  accepts: 'string',
  produces: 'string',
  tags: ['markdown', 'html', 'marked', 'gfm', 'render', 'convert'],
  examples: [
    {
      title: 'heading, bold and a link',
      input: '# Title\n\nSome **bold** text and a [link](https://example.com).',
      output: '<h1>Title</h1>\n<p>Some <strong>bold</strong> text and a <a href="https://example.com">link</a>.</p>\n'
    },
    {
      title: 'heading ids',
      input: '## Sub\n\nHello',
      params: { headerIds: true },
      output: '<h2 id="sub">Sub</h2>\n<p>Hello</p>\n'
    }
  ],
  params: {
    gfm: { kind: 'boolean', label: 'github flavored markdown', default: true },
    breaks: { kind: 'boolean', label: 'newlines become <br>', default: false },
    headerIds: { kind: 'boolean', label: 'add ids to headings', default: false }
  },
  apply: async (input: any, params: any) => {
    const md = asText(input)
    if (md === '') return ''

    const gfm = asBool(params?.gfm, true)
    const breaks = asBool(params?.breaks, false)
    const headerIds = asBool(params?.headerIds, false)

    const { marked } = await getMarked()

    let html: string
    try {
      // marked.parse() may hand back a promise depending on configuration.
      html = await marked.parse(md, { gfm, breaks })
    } catch (e: any) {
      throw new Error(`could not parse markdown: ${e?.message || String(e)}`)
    }

    return headerIds ? addHeaderIds(html) : html
  }
}

export default util
