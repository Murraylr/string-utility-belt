import type { Utility } from '@/types/utility'

const ESCAPES: Record<string, string> = { n: '\n', t: '\t', r: '\r', '0': '\0', '\\': '\\' }

/** Let users type `\n` / `\t` into the single-line separator field. */
const unescapeSeparator = (raw: unknown, fallback: string): string => {
  if (raw === undefined || raw === null) return fallback
  return String(raw).replace(/\\([ntr0\\])/g, (_m, c: string) => ESCAPES[c])
}

const FORMATS = ['hex', 'decimal', 'u-plus', 'escaped'] as const

const hex = (cp: number) => cp.toString(16).toUpperCase().padStart(4, '0')

const util: Utility = {
  id: 'codepoints_encode',
  name: 'to code points',
  category: 'Encoding',
  description: 'List every Unicode code point of the text as U+XXXX, plain hex, decimal or \\u{...} escapes.',
  accepts: 'string',
  produces: 'string',
  tags: ['codepoint', 'unicode', 'u+', 'encode', 'character'],
  params: {
    format: { kind: 'select', label: 'format', options: [...FORMATS], default: 'u-plus' },
    separator: { kind: 'string', label: 'separator', default: ' ', placeholder: 'space, \\n, ...' }
  },
  examples: [
    { title: 'U+ format', input: 'Hi!', output: 'U+0048 U+0069 U+0021' },
    { title: 'decimal, astral character', input: 'A😀', params: { format: 'decimal', separator: ',' }, output: '65,128512' }
  ],
  apply: (input: any, params: any = {}) => {
    const raw = String(params?.format ?? 'u-plus')
    const format = (FORMATS as readonly string[]).includes(raw) ? raw : 'u-plus'
    const separator = unescapeSeparator(params?.separator, ' ')

    const s = String(input ?? '')
    if (s === '') return ''

    // Array.from iterates code points, so astral characters stay whole.
    return Array.from(s)
      .map((ch) => {
        const cp = ch.codePointAt(0) as number
        switch (format) {
          case 'hex':
            return hex(cp)
          case 'decimal':
            return String(cp)
          case 'escaped':
            return `\\u{${hex(cp)}}`
          default:
            return `U+${hex(cp)}`
        }
      })
      .join(separator)
  }
}

export default util
