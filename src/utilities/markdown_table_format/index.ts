import type { Utility } from '@/types/utility'

type Align = 'none' | 'left' | 'center' | 'right'
type Row = { cells: string[]; lead: boolean; trail: boolean }

const ALIGN_OPTIONS = ['preserve', 'left', 'center', 'right'] as const
type AlignParam = (typeof ALIGN_OPTIONS)[number]

/** Combining marks, zero-width characters and variation selectors take no columns. */
const ZERO_WIDTH_RANGES: ReadonlyArray<readonly [number, number]> = [
  [0x0300, 0x036f], [0x0483, 0x0489], [0x0591, 0x05bd], [0x0610, 0x061a],
  [0x064b, 0x065f], [0x0670, 0x0670], [0x06d6, 0x06dc], [0x0711, 0x0711],
  [0x0e31, 0x0e31], [0x0e34, 0x0e3a], [0x0e47, 0x0e4e], [0x1ab0, 0x1aff],
  [0x1dc0, 0x1dff], [0x200b, 0x200f], [0x2060, 0x2064], [0x20d0, 0x20f0],
  [0x3099, 0x309a], [0xfe00, 0xfe0f], [0xfe20, 0xfe2f], [0xfeff, 0xfeff]
]

/** East Asian Wide / Fullwidth plus the common emoji blocks: two columns each. */
const WIDE_RANGES: ReadonlyArray<readonly [number, number]> = [
  [0x1100, 0x115f], [0x2e80, 0x303e], [0x3041, 0x33ff], [0x3400, 0x4dbf],
  [0x4e00, 0x9fff], [0xa000, 0xa4cf], [0xa960, 0xa97f], [0xac00, 0xd7a3],
  [0xf900, 0xfaff], [0xfe10, 0xfe19], [0xfe30, 0xfe6f], [0xff00, 0xff60],
  [0xffe0, 0xffe6], [0x1f004, 0x1f004], [0x1f0cf, 0x1f0cf], [0x1f18e, 0x1f18e],
  [0x1f200, 0x1f2ff], [0x1f300, 0x1f64f], [0x1f680, 0x1f6ff], [0x1f900, 0x1f9ff],
  [0x1fa70, 0x1faff], [0x20000, 0x3fffd]
]

const inRanges = (cp: number, ranges: ReadonlyArray<readonly [number, number]>): boolean =>
  ranges.some(([lo, hi]) => cp >= lo && cp <= hi)

/**
 * Monospace column count of a string. Iterates CODE POINTS (`for..of`), so an
 * astral character such as an emoji is one unit, never two surrogate halves.
 */
export const displayWidth = (text: string): number => {
  let width = 0
  for (const ch of text) {
    const cp = ch.codePointAt(0) ?? 0
    if (inRanges(cp, ZERO_WIDTH_RANGES)) continue
    width += inRanges(cp, WIDE_RANGES) ? 2 : 1
  }
  return width
}

/**
 * Everything before the table content on a line: indentation and any blockquote
 * markers. Tables live inside list items and block quotes all the time, and the
 * prefix has to survive verbatim — stripping it would pull the table out of its
 * container and change how the document renders.
 */
const LINE_PREFIX = /^[ \t]*(?:>[ \t]*)*/
const prefixOf = (line: string): string => LINE_PREFIX.exec(line)?.[0] ?? ''
/** Two lines belong to the same table only if they sit at the same quote depth. */
const quoteDepth = (prefix: string): number => (prefix.match(/>/g) ?? []).length

/** A ``` / ~~~ code-fence marker, if this line opens or closes one. */
const FENCE = /^(`{3,}|~{3,})/
const fenceMarker = (line: string): string | null =>
  FENCE.exec(line.slice(prefixOf(line).length))?.[1] ?? null

/** True when the backslash run immediately before `index` escapes that char. */
const isEscaped = (text: string, index: number): boolean => {
  let backslashes = 0
  for (let i = index - 1; i >= 0 && text[i] === '\\'; i--) backslashes++
  return backslashes % 2 === 1
}

const hasPipe = (line: string): boolean => {
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '\\') {
      i++
      continue
    }
    if (line[i] === '|') return true
  }
  return false
}

/** Split one table line into trimmed cells, remembering its outer pipes. */
const splitRow = (line: string): Row => {
  let rest = line.trim()
  let lead = false
  let trail = false
  if (rest.startsWith('|')) {
    lead = true
    rest = rest.slice(1)
  }
  if (rest.length > 0 && rest.endsWith('|') && !isEscaped(rest, rest.length - 1)) {
    trail = true
    rest = rest.slice(0, -1)
  }
  const cells: string[] = []
  let current = ''
  for (let i = 0; i < rest.length; i++) {
    const ch = rest[i]
    if (ch === '\\' && i + 1 < rest.length) {
      // Keep `\|` (and `\\`) intact — the escape is part of the cell source.
      current += ch + rest[i + 1]
      i++
      continue
    }
    if (ch === '|') {
      cells.push(current.trim())
      current = ''
      continue
    }
    current += ch
  }
  cells.push(current.trim())
  return { cells, lead, trail }
}

const DELIMITER_CELL = /^(:?)-+(:?)$/

const parseAlign = (cell: string): Align | null => {
  const m = DELIMITER_CELL.exec(cell.trim())
  if (!m) return null
  if (m[1] && m[2]) return 'center'
  if (m[1]) return 'left'
  if (m[2]) return 'right'
  return 'none'
}

const isDelimiterLine = (line: string): boolean => {
  if (!hasPipe(line)) return false
  const { cells } = splitRow(line)
  return cells.length > 0 && cells.every((cell) => parseAlign(cell) !== null)
}

const padCell = (cell: string, width: number, align: Align): string => {
  const deficit = Math.max(0, width - displayWidth(cell))
  if (deficit === 0) return cell
  if (align === 'right') return ' '.repeat(deficit) + cell
  if (align === 'center') {
    const left = Math.floor(deficit / 2)
    return ' '.repeat(left) + cell + ' '.repeat(deficit - left)
  }
  return cell + ' '.repeat(deficit)
}

/** `---`, `:--`, `--:` or `:-:` stretched to `width` (never below 3). */
const delimiterCell = (width: number, align: Align): string => {
  const w = Math.max(3, width)
  if (align === 'left') return ':' + '-'.repeat(w - 1)
  if (align === 'right') return '-'.repeat(w - 1) + ':'
  if (align === 'center') return ':' + '-'.repeat(w - 2) + ':'
  return '-'.repeat(w)
}

const formatTable = (
  header: Row,
  delimiter: Row,
  body: Row[],
  alignParam: AlignParam,
  compact: boolean
): string[] => {
  const dataRows = [header, ...body]
  // Never drop cells: a ragged row widens the table instead of being truncated.
  const columns = Math.max(delimiter.cells.length, ...dataRows.map((r) => r.cells.length))

  const aligns: Align[] = []
  for (let c = 0; c < columns; c++) {
    const parsed = c < delimiter.cells.length ? parseAlign(delimiter.cells[c]) : null
    aligns.push(alignParam === 'preserve' ? (parsed ?? 'none') : alignParam)
  }

  const widths: number[] = []
  for (let c = 0; c < columns; c++) {
    let width = 3 // a delimiter cell needs at least three dashes
    for (const row of dataRows) width = Math.max(width, displayWidth(row.cells[c] ?? ''))
    widths.push(width)
  }

  const { lead, trail } = header
  const render = (cells: string[]): string => {
    if (compact) return (lead ? '|' : '') + cells.join('|') + (trail ? '|' : '')
    const line = (lead ? '| ' : '') + cells.join(' | ') + (trail ? ' |' : '')
    // Without a closing pipe there is nothing to align to, so drop the padding.
    return trail ? line : line.replace(/[ \t]+$/, '')
  }

  /**
   * Where the padding of a cell goes. Right/centre padding of the FIRST column
   * of a table with no opening pipe would put spaces at the start of the line —
   * four of them turn the whole table into an indented code block. Placing that
   * column's padding on the right keeps every following pipe in the same place
   * (the cell is still `widths[0]` wide) without ever indenting the line.
   */
  const placement = (c: number): Align => (c === 0 && !lead ? 'left' : aligns[c])

  const cellsFor = (row: Row): string[] =>
    Array.from({ length: columns }, (_, c) =>
      compact ? (row.cells[c] ?? '') : padCell(row.cells[c] ?? '', widths[c], placement(c))
    )

  return [
    render(cellsFor(header)),
    render(aligns.map((align, c) => delimiterCell(compact ? 3 : widths[c], align))),
    ...body.map((row) => render(cellsFor(row)))
  ]
}

const util: Utility = {
  id: 'markdown_table_format',
  name: 'markdown table prettify',
  category: 'Formatting',
  description:
    'Pad the cells of every markdown pipe table so the pipes line up, preserving or overriding the alignment row, with an optional compact (unpadded) style.',
  accepts: 'string',
  produces: 'string',
  tags: ['markdown', 'table', 'gfm', 'pretty print', 'align pipes'],
  aliases: ['mdformat'],
  examples: [
    {
      title: 'pad a compact table',
      input: '| a | bb |\n|---|---|\n| 1 | 2 |',
      output: '| a   | bb  |\n| --- | --- |\n| 1   | 2   |'
    }
  ],
  params: {
    align: {
      kind: 'select',
      label: 'column alignment',
      options: [...ALIGN_OPTIONS],
      default: 'preserve'
    },
    compact: { kind: 'boolean', label: 'compact (no padding)', default: false }
  },
  apply: (input: any, params: any) => {
    const source = String(input ?? '')
    if (source.trim() === '') return ''

    const alignParam: AlignParam =
      typeof params?.align === 'string' &&
      (ALIGN_OPTIONS as readonly string[]).includes(params.align)
        ? (params.align as AlignParam)
        : 'preserve'
    const compact = params?.compact === true

    // Old-Mac lone `\r` counts as a line break too, so split on all three forms.
    const eol = source.includes('\r\n')
      ? '\r\n'
      : !source.includes('\n') && source.includes('\r')
        ? '\r'
        : '\n'
    const lines = source.split(/\r\n|\n|\r/)
    const out: string[] = []
    let tables = 0
    let fence: string | null = null

    let i = 0
    while (i < lines.length) {
      const raw = lines[i]

      // --- fenced code blocks are sample text, never tables to reformat ------
      const marker = fenceMarker(raw)
      if (fence !== null) {
        if (marker !== null && marker[0] === fence[0] && marker.length >= fence.length) fence = null
        out.push(raw)
        i++
        continue
      }
      if (marker !== null) {
        fence = marker
        out.push(raw)
        i++
        continue
      }

      const prefix = prefixOf(raw)
      const depth = quoteDepth(prefix)
      const headerText = raw.slice(prefix.length)
      const next = lines[i + 1]
      if (next !== undefined && headerText.trim() !== '' && hasPipe(headerText)) {
        const nextPrefix = prefixOf(next)
        const delimiterText = next.slice(nextPrefix.length)
        if (quoteDepth(nextPrefix) === depth && isDelimiterLine(delimiterText)) {
          const header = splitRow(headerText)
          const delimiter = splitRow(delimiterText)
          // GFM only recognises a table when header and delimiter agree on width.
          if (header.cells.length === delimiter.cells.length) {
            let j = i + 2
            const body: Row[] = []
            while (j < lines.length) {
              const bodyPrefix = prefixOf(lines[j])
              const bodyText = lines[j].slice(bodyPrefix.length)
              if (quoteDepth(bodyPrefix) !== depth || bodyText.trim() === '' || !hasPipe(bodyText)) {
                break
              }
              body.push(splitRow(bodyText))
              j++
            }
            // Re-attach the header's indentation / quote markers to every line.
            for (const line of formatTable(header, delimiter, body, alignParam, compact)) {
              out.push(prefix + line)
            }
            tables++
            i = j
            continue
          }
        }
      }
      out.push(raw)
      i++
    }

    if (tables === 0) {
      throw new Error(
        'no markdown table found (expected a header row followed by a |---|---| separator row)'
      )
    }
    return out.join(eol)
  }
}

export default util
