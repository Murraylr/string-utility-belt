import type { Utility } from '@/types/utility'

type LinePart = { text: string; eol: string }

/** Split into lines while remembering each line's original terminator (LF / CRLF / CR). */
const splitLines = (s: string): LinePart[] => {
  const out: LinePart[] = []
  const re = /\r\n|\n|\r/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(s)) !== null) {
    out.push({ text: s.slice(last, m.index), eol: m[0] })
    last = re.lastIndex
  }
  out.push({ text: s.slice(last), eol: '' })
  return out
}

const isBlank = (ch: string) => ch === ' ' || ch === '\t'

const numParam = (v: unknown, def: number, label: string) => {
  if (v === undefined || v === null || v === '') return def
  const n = Number(v)
  if (!Number.isFinite(n)) throw new Error(`${label} must be a number`)
  return n
}

const boolParam = (v: unknown, def: boolean) => {
  if (v === undefined || v === null || v === '') return def
  if (typeof v === 'string') return v !== 'false' && v !== '0'
  return Boolean(v)
}

/** Expand tabs to the next real tab stop. Columns are counted in code points. */
export const expandTabs = (line: string, tabWidth: number, leadingOnly: boolean): string => {
  const cps = Array.from(line)
  let out = ''
  let col = 0
  for (let i = 0; i < cps.length; i++) {
    const ch = cps[i]
    if (leadingOnly && !isBlank(ch)) return out + cps.slice(i).join('')
    if (ch === '\t') {
      const n = tabWidth - (col % tabWidth)
      out += ' '.repeat(n)
      col += n
    } else {
      out += ch
      col += 1
    }
  }
  return out
}

/**
 * Collapse blank runs back onto real tab stops. A run of a single space is left
 * alone (it is word spacing, not indentation); runs of 2+ blanks, or any run
 * containing a tab, are re-emitted as tabs plus leftover spaces.
 */
export const collapseToTabs = (line: string, tabWidth: number, leadingOnly: boolean): string => {
  const cps = Array.from(line)
  let out = ''
  let col = 0
  let i = 0
  let seenText = false
  while (i < cps.length) {
    if (!isBlank(cps[i])) {
      out += cps[i]
      col += 1
      seenText = true
      i++
      continue
    }
    const startCol = col
    let j = i
    let endCol = col
    let hasTab = false
    while (j < cps.length && isBlank(cps[j])) {
      if (cps[j] === '\t') {
        hasTab = true
        endCol += tabWidth - (endCol % tabWidth)
      } else {
        endCol += 1
      }
      j++
    }
    const runLength = j - i
    const convertible = !(leadingOnly && seenText) && (runLength >= 2 || hasTab)
    if (convertible) {
      let c = startCol
      let seg = ''
      for (;;) {
        const next = c + tabWidth - (c % tabWidth)
        if (next <= endCol) {
          seg += '\t'
          c = next
        } else break
      }
      out += seg + ' '.repeat(endCol - c)
    } else {
      out += cps.slice(i, j).join('')
    }
    col = endCol
    i = j
  }
  return out
}

const DIRECTIONS = ['tabs-to-spaces', 'spaces-to-tabs']

const util: Utility = {
  id: 'tabs_spaces',
  name: 'tabs ↔ spaces',
  category: 'Formatting',
  description:
    'Convert tabs to spaces or spaces back to tabs using real tab stops, with a configurable tab width and an option to touch leading whitespace only.',
  accepts: 'string',
  produces: 'string',
  tags: ['tab', 'space', 'indent', 'indentation', 'whitespace', 'convert', 'align', 'tab width'],
  aliases: ['expand', 'unexpand'],
  streamable: true,
  examples: [
    {
      title: 'tabs to spaces',
      input: '\tfoo\tbar',
      output: '    foo bar'
    },
    {
      title: 'spaces to tabs',
      input: '        indented',
      params: { direction: 'spaces-to-tabs' },
      output: '\t\tindented'
    }
  ],
  params: {
    direction: {
      kind: 'select',
      label: 'direction',
      options: DIRECTIONS,
      default: 'tabs-to-spaces'
    },
    tabWidth: { kind: 'number', label: 'tab width', default: 4, min: 1, integer: true, max: 64 },
    leadingOnly: { kind: 'boolean', label: 'leading whitespace only', default: false }
  },
  apply: (input: any, params: any) => {
    const p = params || {}
    const s = input === undefined || input === null ? '' : String(input)
    const direction = (p.direction as string) || 'tabs-to-spaces'
    const tabWidth = numParam(p.tabWidth, 4, 'tab width')
    const leadingOnly = boolParam(p.leadingOnly, false)

    if (!DIRECTIONS.includes(direction)) throw new Error(`unknown direction: ${direction}`)
    if (!Number.isInteger(tabWidth) || tabWidth < 1) {
      throw new Error('tab width must be a whole number >= 1')
    }
    if (s === '') return ''

    const convert =
      direction === 'spaces-to-tabs'
        ? (line: string) => collapseToTabs(line, tabWidth, leadingOnly)
        : (line: string) => expandTabs(line, tabWidth, leadingOnly)

    return splitLines(s)
      .map(({ text, eol }) => convert(text) + eol)
      .join('')
  }
}

export default util
