import type { Utility } from '@/types/utility'

// turndown is loaded lazily so it never lands in the app's initial bundle
// (src/utilities/index.ts eagerly globs every utility module). The promise is
// cached, so the pipeline re-running on every keystroke imports it only once.
const loadTurndown = () => import('turndown')
let _turndown: ReturnType<typeof loadTurndown> | null = null
const getTurndown = () => (_turndown ??= loadTurndown())

const HEADING_STYLES = ['atx', 'setext'] as const
const BULLET_MARKERS = ['-', '*', '+'] as const
const CODE_BLOCK_STYLES = ['fenced', 'indented'] as const

function pick<T extends string>(value: unknown, options: readonly T[], fallback: T, label: string): T {
  if (value === undefined || value === null || value === '') return fallback
  const v = String(value)
  if ((options as readonly string[]).includes(v)) return v as T
  throw new Error(`unknown ${label} "${v}" (expected one of: ${options.join(', ')})`)
}

function asText(input: unknown): string {
  if (input === undefined || input === null) return ''
  if (typeof input === 'string') return input
  if (input instanceof Uint8Array) return new TextDecoder().decode(input)
  if (typeof input === 'object') {
    throw new Error('html to markdown expects HTML text, but received structured data')
  }
  return String(input)
}

const util: Utility = {
  id: 'html_to_markdown',
  name: 'html to markdown',
  category: 'Data Formats',
  description:
    'Convert HTML into Markdown, choosing atx or setext headings, the bullet marker, and fenced or indented code blocks.',
  accepts: 'string',
  produces: 'string',
  tags: ['html', 'markdown', 'turndown', 'convert', 'md', 'strip html'],
  examples: [
    {
      title: 'heading, bold, link',
      input: '<h1>Title</h1><p>Some <strong>bold</strong> and <a href="https://example.com">a link</a>.</p>',
      output: '# Title\n\nSome **bold** and [a link](https://example.com).'
    },
    {
      title: 'custom bullet marker',
      input: '<ul><li>one</li><li>two</li></ul>',
      params: { bulletMarker: '*' },
      output: '*   one\n*   two'
    }
  ],
  params: {
    headingStyle: {
      kind: 'select',
      label: 'heading style',
      options: [...HEADING_STYLES],
      default: 'atx'
    },
    bulletMarker: {
      kind: 'select',
      label: 'bullet marker',
      options: [...BULLET_MARKERS],
      default: '-'
    },
    codeBlockStyle: {
      kind: 'select',
      label: 'code block style',
      options: [...CODE_BLOCK_STYLES],
      default: 'fenced'
    }
  },
  apply: async (input: any, params: any) => {
    const html = asText(input)
    const headingStyle = pick(params?.headingStyle, HEADING_STYLES, 'atx', 'heading style')
    const bulletListMarker = pick(params?.bulletMarker, BULLET_MARKERS, '-', 'bullet marker')
    const codeBlockStyle = pick(params?.codeBlockStyle, CODE_BLOCK_STYLES, 'fenced', 'code block style')

    if (html.trim() === '') return ''

    const { default: TurndownService } = await getTurndown()

    try {
      const service = new TurndownService({ headingStyle, bulletListMarker, codeBlockStyle })
      // Turndown keeps the text content of unknown elements, which would spill
      // stylesheet and script source into the prose. Drop those subtrees.
      service.remove(['script', 'style', 'noscript'])
      return service.turndown(html)
    } catch (e: any) {
      throw new Error(`could not convert html to markdown: ${e?.message || String(e)}`)
    }
  }
}

export default util
