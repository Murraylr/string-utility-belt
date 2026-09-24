import type { Utility } from '@/types/utility'

/** Escapes a user can type into a single-line param box. */
const ESCAPES: Record<string, string> = { n: '\n', r: '\r', t: '\t', '0': '\0', '\\': '\\' }

/**
 * Turn `\t`/`\n`-style text into the real character so a tab prefix or a newline
 * joiner can be typed into a one-line input. Unknown escapes (`\d`, `\item`, a
 * lone `\`) are left alone so LaTeX and regex snippets survive verbatim.
 */
function decodeEscapes(raw: unknown): string {
  if (raw === undefined || raw === null) return ''
  return String(raw).replace(/\\([nrt0\\])/g, (_m, c: string) => ESCAPES[c])
}

type LineDoc = {
  lines: string[]
  /** The line ending to rebuild with — CRLF wins if the document uses it anywhere. */
  eol: string
  /** Did the document end with a newline? Restored so the final EOL survives. */
  trailing: boolean
}

function splitDoc(text: string): LineDoc {
  const eol = text.includes('\r\n') ? '\r\n' : !text.includes('\n') && text.includes('\r') ? '\r' : '\n'
  const m = /(\r\n|\n|\r)$/.exec(text)
  const body = m ? text.slice(0, text.length - m[1].length) : text
  return { lines: body.split(/\r\n|\n|\r/), eol, trailing: Boolean(m) }
}

const util: Utility = {
  id: 'line_affix',
  name: 'prefix / suffix lines',
  category: 'Lines',
  description:
    'Add a prefix and/or suffix to every line, optionally skipping blank lines and joining the result with a custom separator such as ", ".',
  accepts: 'string',
  produces: 'string',
  params: {
    prefix: { kind: 'string', label: 'prefix', default: '', placeholder: "'" },
    suffix: { kind: 'string', label: 'suffix', default: '', placeholder: "'" },
    skipBlank: { kind: 'boolean', label: 'skip blank lines', default: true },
    joinWith: {
      kind: 'string',
      label: 'join with (blank = newline)',
      default: '',
      placeholder: ', '
    }
  },
  tags: ['prefix lines', 'suffix lines', 'add prefix', 'wrap lines', 'sql in list', 'decorate lines'],
  examples: [
    { title: 'SQL IN-list', input: 'apple\nbanana\ncherry', params: { prefix: "'", suffix: "'", joinWith: ', ' }, output: "'apple', 'banana', 'cherry'" },
    { title: 'bullet prefix', input: 'a\nb', params: { prefix: '- ' }, output: '- a\n- b' }
  ],
  apply: (input: any, params: any): any => {
    const p = params ?? {}
    const prefix = decodeEscapes(p.prefix ?? '')
    const suffix = decodeEscapes(p.suffix ?? '')
    const joinWith = decodeEscapes(p.joinWith ?? '')
    const skipBlank = p.skipBlank !== false

    const text = String(input)
    // No input is not "one blank line": an empty document stays empty, otherwise a
    // freshly added step would emit its bare affixes (`- ` / `''`) over nothing.
    if (text === '') return ''

    const doc = splitDoc(text)
    const affix = (line: string) => `${prefix}${line}${suffix}`
    const blank = (line: string) => line.trim() === ''

    if (joinWith !== '') {
      // Joining onto one line (the SQL IN-list case): a skipped blank line would
      // otherwise show up as an empty item like `'a', , 'b'`, so drop it entirely.
      const parts = doc.lines.filter(line => !(skipBlank && blank(line))).map(affix)
      return parts.join(joinWith)
    }

    const out = doc.lines.map(line => (skipBlank && blank(line) ? line : affix(line)))
    return out.join(doc.eol) + (doc.trailing ? doc.eol : '')
  }
}

export default util
