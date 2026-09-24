import type { Utility } from '@/types/utility'

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
    throw new Error('strip markdown expects Markdown text, but received structured data')
  }
  return String(input)
}

/** `***`, `---` or `___` on its own line: a thematic break. */
const HR_RE = /^[ \t]{0,3}(?:(?:\*[ \t]*){3,}|(?:-[ \t]*){3,}|(?:_[ \t]*){3,})$/
/** A setext heading underline (`===` / `---`) — the heading text above it survives, this does not. */
const SETEXT_RE = /^[ \t]{0,3}(?:=+|-+)[ \t]*$/
/** An opening (or closing) code fence. */
const FENCE_RE = /^[ \t]{0,3}(`{3,}|~{3,})(?:.*)$/
const FENCE_CLOSE_RE = /^[ \t]{0,3}(`{3,}|~{3,})[ \t]*$/
/** A link reference definition: `[label]: https://example.com "title"`. */
const REF_DEF_RE = /^[ \t]{0,3}\[[^\]]+\]:[ \t]*\S+.*$/

/** Remove leading block-level markers: blockquotes, headings, list bullets, task boxes. */
function stripBlockMarkers(line: string): string {
  let t = line.replace(/^[ \t]{0,3}(?:>[ \t]?)+/, '')

  // the content is captured greedily and its trailing blanks trimmed after: a lazy
  // capture followed by [ \t]*$ is quadratic on a long inner run of spaces
  const atx = t.match(/^[ \t]{0,3}(#{1,6})(?:[ \t]+([\s\S]*))?$/)
  if (atx) {
    return (atx[2] ?? '').replace(/(?<![ \t])[ \t]+$/, '').replace(/(?<![ \t])[ \t]+#+$/, '')
  }

  t = t.replace(/^([ \t]*)(?:[-*+]|\d{1,9}[.)])[ \t]+/, '$1')
  t = t.replace(/^([ \t]*)\[[ xX]\][ \t]+/, '$1')
  return t
}

/** CommonMark strips one padding space from each end of a code span. */
function trimCodeSpan(body: string): string {
  if (body.length > 1 && body.startsWith(' ') && body.endsWith(' ') && body.trim() !== '') {
    return body.slice(1, -1)
  }
  return body
}

function linkLabel(text: string, url: string, keepLinkUrls: boolean): string {
  const label = text.trim()
  if (!keepLinkUrls) return label
  const target = (url || '').trim().replace(/^<|>$/g, '')
  if (!target) return label
  return label ? `${label} (${target})` : target
}

function stripInline(line: string, keepLinkUrls: boolean, stash: (value: string) => string): string {
  let t = line

  // Code spans are pulled out first so their contents survive the passes below.
  t = t.replace(/(?<!\\)(`+)([\s\S]+?)\1(?!`)/g, (_m, _ticks: string, body: string) =>
    stash(trimCodeSpan(body))
  )

  // Autolinks first: <https://example.com> / <mailto:a@b.c> / <me@example.com>
  // would otherwise look like raw HTML tags to the pass below.
  t = t.replace(/<((?:[a-zA-Z][a-zA-Z0-9+.-]*:|www\.)[^>\s]*)>/g, '$1')
  t = t.replace(/<([^\s<>@]+@[^\s<>@]+\.[^\s<>]+)>/g, '$1')

  // Raw HTML
  t = t.replace(/<!--[\s\S]*?-->/g, '')
  t = t.replace(/<\/?[a-zA-Z][^>]*>/g, '')

  // Images then inline links (images first so `![x](y)` never falls through as a link)
  const inlineTarget = /\(\s*([^)\s]*)(?:\s+"[^"]*"|\s+'[^']*')?\s*\)/.source
  t = t.replace(
    new RegExp(`!\\[([^\\]]*)\\]${inlineTarget}`, 'g'),
    (_m, alt: string, url: string) => linkLabel(alt, url, keepLinkUrls)
  )
  t = t.replace(
    new RegExp(`\\[([^\\]]*)\\]${inlineTarget}`, 'g'),
    (_m, text: string, url: string) => linkLabel(text, url, keepLinkUrls)
  )

  // Reference links and images: [text][ref] / ![alt][ref]
  t = t.replace(/!?\[([^\]]*)\]\[[^\]]*\]/g, '$1')

  // Emphasis, widest delimiters first. `_` only counts at word boundaries so
  // snake_case_identifiers survive untouched.
  t = t.replace(/(?<!\\)\*\*\*(?=\S)([\s\S]*?\S)(?<!\\)\*\*\*/g, '$1')
  t = t.replace(/(?<![\p{L}\p{N}\\])___(?=\S)([\s\S]*?\S)___(?![\p{L}\p{N}])/gu, '$1')
  t = t.replace(/(?<!\\)\*\*(?=\S)([\s\S]*?\S)(?<!\\)\*\*/g, '$1')
  t = t.replace(/(?<![\p{L}\p{N}\\])__(?=\S)([\s\S]*?\S)__(?![\p{L}\p{N}])/gu, '$1')
  t = t.replace(/(?<!\\)\*(?=\S)([\s\S]*?\S)(?<!\\)\*/g, '$1')
  t = t.replace(/(?<![\p{L}\p{N}\\])_(?=\S)([\s\S]*?\S)_(?![\p{L}\p{N}])/gu, '$1')
  t = t.replace(/(?<!\\)~~([\s\S]*?)~~/g, '$1')

  // Backslash escapes are literal characters in the plain-text output.
  t = t.replace(/\\([\\`*_{}[\]()#+\-.!>~|])/g, '$1')

  return t
}

const NUL = String.fromCharCode(0)

function stripMarkdown(src: string, keepLinkUrls: boolean, keepCodeBlocks: boolean): string {
  const text = src.replace(/\r\n?/g, '\n')

  // A sentinel guaranteed not to collide with anything already in the document.
  let sentinel = NUL
  while (text.includes(sentinel)) sentinel += NUL
  const codes: string[] = []
  const stash = (value: string) => {
    codes.push(value)
    return `${sentinel}${codes.length - 1}${sentinel}`
  }

  const rows: { text: string; literal: boolean }[] = []
  let fence: string | null = null

  for (const raw of text.split('\n')) {
    if (fence !== null) {
      const close = raw.match(FENCE_CLOSE_RE)
      if (close && close[1][0] === fence[0] && close[1].length >= fence.length) {
        fence = null
        continue
      }
      if (keepCodeBlocks) rows.push({ text: raw, literal: true })
      continue
    }

    const open = raw.match(FENCE_RE)
    if (open) {
      fence = open[1]
      continue
    }

    if (REF_DEF_RE.test(raw)) continue
    if (SETEXT_RE.test(raw) || HR_RE.test(raw)) continue

    rows.push({ text: stripBlockMarkers(raw), literal: false })
  }

  // Inline markup is stripped a paragraph at a time, not a line at a time:
  // `*soft\nwrapped*` is a single emphasis span in CommonMark, and wrapped prose
  // is the normal case. A blank line ends the span, so paragraphs never merge.
  const out: string[] = []
  let paragraph: string[] = []
  const flush = () => {
    if (paragraph.length === 0) return
    out.push(stripInline(paragraph.join('\n'), keepLinkUrls, stash))
    paragraph = []
  }
  for (const row of rows) {
    if (row.literal || row.text.trim() === '') {
      flush()
      out.push(row.text)
    } else {
      paragraph.push(row.text)
    }
  }
  flush()

  const joined = out.join('\n')

  const restored = joined.replace(
    new RegExp(`${sentinel}(\\d+)${sentinel}`, 'g'),
    (_m, index: string) => codes[Number(index)] ?? ''
  )

  return restored
    .split('\n')
    .map((line) => line.replace(/(?<![ \t])[ \t]+$/, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

const util: Utility = {
  id: 'markdown_strip',
  name: 'strip markdown',
  category: 'String Ops',
  description:
    'Strip Markdown formatting down to plain text, optionally keeping link urls and the contents of code blocks.',
  accepts: 'string',
  produces: 'string',
  tags: ['markdown', 'md to text', 'plain text', 'commonmark', 'remove formatting', 'strip formatting'],
  examples: [
    {
      title: 'headings, emphasis and links',
      input: '# Title\n\nSome **bold** and _italic_ text with a [link](https://example.com).',
      output: 'Title\n\nSome bold and italic text with a link.'
    },
    {
      title: 'keep link urls and code block contents',
      input: '# Title\n\n```js\nconst x = 1;\n```\n\nSee [docs](https://example.com/docs).',
      params: { keepLinkUrls: true, keepCodeBlocks: true },
      output: 'Title\n\nconst x = 1;\n\nSee docs (https://example.com/docs).'
    }
  ],
  params: {
    keepLinkUrls: { kind: 'boolean', label: 'keep link urls', default: false },
    keepCodeBlocks: { kind: 'boolean', label: 'keep code block contents', default: true }
  },
  apply: (input: any, params: any) => {
    const md = asText(input)
    if (md === '') return ''
    return stripMarkdown(md, asBool(params?.keepLinkUrls, false), asBool(params?.keepCodeBlocks, true))
  }
}

export default util
