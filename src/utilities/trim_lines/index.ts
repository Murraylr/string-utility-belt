import type { Utility } from '@/types/utility'

const SIDES = ['both', 'start', 'end'] as const

/** Escapes a user can type into a single-line param box. */
const ESCAPES: Record<string, string> = { n: '\n', r: '\r', t: '\t', '0': '\0', '\\': '\\' }

/**
 * Turn `\t`/`\n`-style text into the real character so invisible characters can be
 * named in a one-line input. Unknown escapes (`\d`, a lone `\`) are left alone.
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

const WHITESPACE = /\s/u

/**
 * Trim one line. Iterates code points, so a custom set containing an astral
 * character matches it whole instead of eating half a surrogate pair.
 */
function trimLine(line: string, side: string, chars: Set<number> | null): string {
  const cps = Array.from(line)
  const trimmable = (ch: string) =>
    chars ? chars.has(ch.codePointAt(0) as number) : WHITESPACE.test(ch)
  let start = 0
  let end = cps.length
  if (side === 'both' || side === 'start') {
    while (start < end && trimmable(cps[start])) start++
  }
  if (side === 'both' || side === 'end') {
    while (end > start && trimmable(cps[end - 1])) end--
  }
  return cps.slice(start, end).join('')
}

const util: Utility = {
  id: 'trim_lines',
  name: 'trim each line',
  category: 'Lines',
  description:
    'Trim whitespace — or a custom set of characters — from the start, the end, or both sides of every line.',
  accepts: 'string',
  produces: 'string',
  params: {
    side: { kind: 'select', label: 'side', options: [...SIDES], default: 'both' },
    characters: {
      kind: 'string',
      label: 'characters (blank = whitespace)',
      default: '',
      placeholder: '-.,\\t'
    }
  },
  tags: ['trim lines', 'strip whitespace', 'rstrip', 'lstrip', 'trim each line'],
  aliases: ['rstrip', 'lstrip'],
  examples: [
    { title: 'trim both sides', input: '  hello  \n  world  ', output: 'hello\nworld' }
  ],
  apply: (input: any, params: any): any => {
    const p = params ?? {}
    const side = String(p.side ?? 'both')
    if (!(SIDES as readonly string[]).includes(side)) {
      throw new Error(`unknown side "${side}" — use ${SIDES.join(', ')}`)
    }
    const custom = decodeEscapes(p.characters ?? '')
    const chars = custom === '' ? null : new Set(Array.from(custom, c => c.codePointAt(0) as number))

    const doc = splitDoc(String(input))
    const trimmed = doc.lines.map(line => trimLine(line, side, chars))
    return trimmed.join(doc.eol) + (doc.trailing ? doc.eol : '')
  }
}

export default util
