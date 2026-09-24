import type { Utility } from '@/types/utility'

const UNITS = ['characters', 'words'] as const

type LineDoc = {
  lines: string[]
  /** The line ending to rebuild with — CRLF wins if the document uses it anywhere. */
  eol: string
  /** Did the document end with a newline? Restored so filtering keeps the final EOL. */
  trailing: boolean
}

function splitDoc(text: string): LineDoc {
  const eol = text.includes('\r\n') ? '\r\n' : !text.includes('\n') && text.includes('\r') ? '\r' : '\n'
  const m = /(\r\n|\n|\r)$/.exec(text)
  const body = m ? text.slice(0, text.length - m[1].length) : text
  return { lines: body.split(/\r\n|\n|\r/), eol, trailing: Boolean(m) }
}

function joinDoc(lines: string[], doc: LineDoc): string {
  return lines.join(doc.eol) + (doc.trailing ? doc.eol : '')
}

/** Length of a line in code points (so an emoji counts once) or in whitespace-separated words. */
function measure(line: string, unit: string): number {
  if (unit === 'words') {
    const trimmed = line.trim()
    return trimmed === '' ? 0 : trimmed.split(/\s+/u).length
  }
  return Array.from(line).length
}

/**
 * Read a numeric bound, rejecting a value that is not a finite, non-negative
 * number. The value is deliberately NOT rounded: line lengths are integers, so
 * comparing them against the bound as typed is exact — rounding `min: 2.5` down
 * to 2 would quietly keep 2-character lines the user asked to drop.
 */
function readBound(raw: unknown, name: string, fallback: number): number {
  if (raw === undefined || raw === null || raw === '') return fallback
  const n = Number(raw)
  if (!Number.isFinite(n)) throw new Error(`${name} must be a number`)
  if (n < 0) throw new Error(`${name} must be zero or greater`)
  return n
}

const util: Utility = {
  id: 'filter_lines_by_length',
  name: 'filter lines by length',
  category: 'Lines',
  description:
    'Keep only the lines whose length falls between min and max, measured in characters or words, with an option to invert the match.',
  accepts: 'string',
  produces: 'string',
  params: {
    min: { kind: 'number', label: 'min length', default: 0, min: 0 },
    max: { kind: 'number', label: 'max length (0 = no max)', default: 0, min: 0 },
    unit: { kind: 'select', label: 'unit', options: [...UNITS], default: 'characters' },
    invert: { kind: 'boolean', label: 'invert (keep non-matching)', default: false }
  },
  tags: ['line length', 'filter lines', 'character count', 'word count', 'length range', 'line filter'],
  examples: [
    { title: 'by character length', input: 'a\nbb\nccc\ndddd', params: { min: 2, max: 3, unit: 'characters' }, output: 'bb\nccc' },
    { title: 'by word count', input: 'one two\nthree four five\nsix', params: { min: 2, max: 0, unit: 'words' }, output: 'one two\nthree four five' }
  ],
  apply: (input: any, params: any): any => {
    const p = params ?? {}
    const unit = String(p.unit ?? 'characters')
    if (!(UNITS as readonly string[]).includes(unit)) {
      throw new Error(`unknown unit "${unit}" — use ${UNITS.join(' or ')}`)
    }
    const min = readBound(p.min, 'min', 0)
    const max = readBound(p.max, 'max', 0)
    if (max > 0 && min > max) {
      throw new Error(`min (${min}) is greater than max (${max})`)
    }
    const invert = p.invert === true

    const doc = splitDoc(String(input))
    const kept = doc.lines.filter(line => {
      const len = measure(line, unit)
      const inRange = len >= min && (max === 0 || len <= max)
      return invert ? !inRange : inRange
    })
    // Nothing survived: return truly empty text rather than a lone trailing newline.
    return kept.length === 0 ? '' : joinDoc(kept, doc)
  }
}

export default util
