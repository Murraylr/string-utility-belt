import type { Utility } from '@/types/utility'

/** Bullet, numbered, lettered list markers and blockquote arrows. */
const LIST_RE = /^[ \t]*(?:[-*+•‣▪·–—>]|\d+[.)]|[a-zA-Z][.)])[ \t]+\S/

/**
 * Whitespace that may be dropped when lines are joined: everything `\s` matches
 * EXCEPT the non-breaking spaces. U+00A0, U+2007 (figure space), U+202F (narrow
 * no-break space) and U+FEFF are all `\s` in JavaScript, so a plain `trim()` would
 * quietly eat characters the author put there on purpose.
 */
// The lookbehinds let a trailing match start only where a run starts, keeping these linear.
const TRIM_BREAKING = /^[^\S\u00a0\u2007\u202f\ufeff]+|(?<![^\S\u00a0\u2007\u202f\ufeff])[^\S\u00a0\u2007\u202f\ufeff]+$/gu
const TRIM_BREAKING_END = /(?<![^\S\u00a0\u2007\u202f\ufeff])[^\S\u00a0\u2007\u202f\ufeff]+$/u

/** Leading whitespace measured in columns (a tab advances to the next 4-column stop). */
export const indentWidth = (line: string): number => {
  let w = 0
  for (const ch of line) {
    if (ch === ' ') w += 1
    else if (ch === '\t') w += 4 - (w % 4)
    else break
  }
  return w
}

const boolParam = (v: unknown, def: boolean) => {
  if (v === undefined || v === null || v === '') return def
  if (typeof v === 'string') return v !== 'false' && v !== '0'
  return Boolean(v)
}

const strParam = (v: unknown, def: string) => (v === undefined || v === null ? def : String(v))

const trimEnd = (s: string) => s.replace(TRIM_BREAKING_END, '')
const trimBoth = (s: string) => s.replace(TRIM_BREAKING, '')

const util: Utility = {
  id: 'unwrap',
  name: 'unwrap / reflow',
  category: 'Formatting',
  description:
    'Join soft-wrapped lines back into single-line paragraphs using a chosen separator, keeping blank-line breaks and optionally leaving list items and indented blocks intact.',
  accepts: 'string',
  produces: 'string',
  tags: ['reflow', 'join lines', 'dewrap', 'paragraph', 'markdown', 'merge lines', 'unwrap text'],
  aliases: ['fmt', 'join'],
  examples: [
    {
      title: 'joins a soft-wrapped paragraph',
      input: 'This is a\nwrapped paragraph.',
      output: 'This is a wrapped paragraph.'
    },
    {
      title: 'keeps list items and blank-line breaks',
      input: 'Notes:\n\n- first point\n  continued\n- second point',
      output: 'Notes:\n\n- first point continued\n- second point'
    }
  ],
  params: {
    separator: { kind: 'string', label: 'join with', default: ' ' },
    preserveLists: { kind: 'boolean', label: 'keep list items', default: true },
    preserveIndented: { kind: 'boolean', label: 'keep indented blocks', default: true }
  },
  apply: (input: any, params: any) => {
    const p = params || {}
    const s = input === undefined || input === null ? '' : String(input)
    const separator = strParam(p.separator, ' ')
    const preserveLists = boolParam(p.preserveLists, true)
    const preserveIndented = boolParam(p.preserveIndented, true)

    if (/[\r\n]/.test(separator)) throw new Error('separator must not contain a line break')
    if (s === '') return ''

    const out: string[] = []
    let cur: string | null = null
    let inList = false
    const flush = () => {
      if (cur !== null) {
        out.push(cur)
        cur = null
      }
    }

    for (const line of s.split(/\r\n|\n|\r/)) {
      // a line with nothing visible on it is a paragraph break, whatever it is made of
      if (line.trim() === '') {
        flush()
        inList = false
        out.push('')
      } else if (preserveLists && LIST_RE.test(line)) {
        flush()
        cur = trimEnd(line)
        inList = true
      } else if (cur !== null && inList) {
        // a wrapped continuation of the open list item, however it is indented
        cur += separator + trimBoth(line)
      } else if (preserveIndented && indentWidth(line) >= 4) {
        flush()
        inList = false
        out.push(trimEnd(line))
      } else if (cur === null) {
        cur = trimEnd(line)
        inList = false
      } else {
        cur += separator + trimBoth(line)
      }
    }
    flush()
    return out.join('\n')
  }
}

export default util
