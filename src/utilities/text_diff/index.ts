import type { Utility } from '@/types/utility'

/**
 * jsdiff is loaded lazily and cached: src/utilities/index.ts eagerly globs every
 * utility module, so a static import would drag the library into the app's
 * initial bundle and re-import it on every pipeline run.
 */
type DiffModule = typeof import('diff')
let _diff: DiffModule | null = null
const getDiff = async (): Promise<DiffModule> => {
  if (!_diff) _diff = await import('diff')
  return _diff
}

type Change = { value: string; added?: boolean; removed?: boolean; count?: number }
type DiffOptions = {
  ignoreCase?: boolean
  ignoreWhitespace?: boolean
  comparator?: (left: string, right: string) => boolean
}
type StringDiffFn = (a: string, b: string, options: DiffOptions) => Change[] | undefined

const GRANULARITIES = ['lines', 'words', 'characters'] as const
const FORMATS = ['unified', 'inline', 'side-by-side', 'json'] as const
type Granularity = (typeof GRANULARITIES)[number]
type Format = (typeof FORMATS)[number]

type RowType = 'context' | 'remove' | 'add'
interface Row {
  type: RowType
  oldNo: number
  newNo: number
  text: string
}
interface Hunk {
  rows: Row[]
  start: number
  end: number
  oldStart: number
  oldLines: number
  newStart: number
  newLines: number
}

/* ------------------------------------------------------------------ *
 * Param helpers
 * ------------------------------------------------------------------ */

const asBool = (value: unknown, fallback: boolean) =>
  value === undefined || value === null || value === '' ? fallback : !!value

const asNumber = (value: unknown, fallback: number) => {
  // a cleared number input arrives as '' — Number('') is 0, which would silently
  // mean "no context lines" instead of the declared default
  if (value === undefined || value === null || value === '') return fallback
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : fallback
}

function asOption<T extends string>(value: unknown, options: readonly T[], fallback: T, label: string): T {
  if (value === undefined || value === null || value === '') return fallback
  const raw = String(value)
  if (!(options as readonly string[]).includes(raw)) {
    throw new Error(`unknown ${label}: ${raw} (expected ${options.join(', ')})`)
  }
  return raw as T
}

/* ------------------------------------------------------------------ *
 * Text helpers (code-point aware where width matters)
 * ------------------------------------------------------------------ */

const stripEol = (text: string) => text.replace(/\r?\n$/, '')
const cpLength = (text: string) => Array.from(text).length
const padRight = (text: string, width: number) => text + ' '.repeat(Math.max(0, width - cpLength(text)))

/** Split a change value into pieces that each end with a newline (except a trailing partial line). */
function splitLinePieces(value: string): string[] {
  const parts = value.split('\n')
  const out: string[] = []
  for (let i = 0; i < parts.length; i++) {
    if (i < parts.length - 1) out.push(parts[i] + '\n')
    else if (parts[i] !== '') out.push(parts[i])
  }
  return out
}

/* ------------------------------------------------------------------ *
 * Diff driving
 * ------------------------------------------------------------------ */

function pickDiffFn(mod: DiffModule, granularity: Granularity, ignoreWhitespace: boolean): StringDiffFn {
  switch (granularity) {
    case 'words':
      // diffWords compares tokens with their surrounding whitespace stripped;
      // diffWordsWithSpace treats whitespace as significant.
      return (ignoreWhitespace ? mod.diffWords : mod.diffWordsWithSpace) as unknown as StringDiffFn
    case 'characters':
      return mod.diffChars as unknown as StringDiffFn
    default:
      return mod.diffLines as unknown as StringDiffFn
  }
}

function diffOptionsFor(granularity: Granularity, ignoreCase: boolean, ignoreWhitespace: boolean): DiffOptions {
  if (granularity === 'characters' && ignoreWhitespace) {
    // diffChars has no whitespace option, so equality is supplied directly:
    // any whitespace character matches any other.
    return {
      comparator: (left, right) => {
        if (/^\s$/.test(left) && /^\s$/.test(right)) return true
        return ignoreCase ? left.toLowerCase() === right.toLowerCase() : left === right
      }
    }
  }
  const options: DiffOptions = { ignoreCase }
  if (granularity === 'lines') options.ignoreWhitespace = ignoreWhitespace
  return options
}

/* ------------------------------------------------------------------ *
 * Token changes -> line rows
 * ------------------------------------------------------------------ */

/**
 * Within a run of changed rows, list every removal before every addition.
 *
 * Appends one row at a time: `out.push(...run)` would pass every row of the run
 * as a separate argument, which blows the call stack once a run reaches roughly
 * 125k rows (a large file diffed against an empty one is exactly that).
 */
function orderRuns(rows: Row[]): Row[] {
  const out: Row[] = []
  let i = 0
  while (i < rows.length) {
    if (rows[i].type === 'context') {
      out.push(rows[i])
      i++
      continue
    }
    let j = i
    while (j < rows.length && rows[j].type !== 'context') j++
    for (let k = i; k < j; k++) if (rows[k].type === 'remove') out.push(rows[k])
    for (let k = i; k < j; k++) if (rows[k].type === 'add') out.push(rows[k])
    i = j
  }
  return out
}

/**
 * Fold token-level changes into numbered lines. Works for every granularity:
 * a line is "changed" as soon as it contains an added or removed token.
 */
function buildRows(changes: Change[]): Row[] {
  const rows: Row[] = []
  let oldBuf = ''
  let newBuf = ''
  let oldDirty = false
  let newDirty = false
  let oldNo = 0
  let newNo = 0

  const emitOld = () => {
    rows.push({ type: 'remove', oldNo: ++oldNo, newNo: 0, text: oldBuf })
    oldBuf = ''
    oldDirty = false
  }
  const emitNew = () => {
    rows.push({ type: 'add', oldNo: 0, newNo: ++newNo, text: newBuf })
    newBuf = ''
    newDirty = false
  }
  const emitBoth = () => {
    if (!oldDirty && !newDirty && oldBuf === newBuf) {
      rows.push({ type: 'context', oldNo: ++oldNo, newNo: ++newNo, text: oldBuf })
      oldBuf = ''
      newBuf = ''
      return
    }
    if (oldBuf !== '' || oldDirty) emitOld()
    if (newBuf !== '' || newDirty) emitNew()
  }

  for (const change of changes) {
    const kind: RowType = change.added ? 'add' : change.removed ? 'remove' : 'context'
    for (const piece of splitLinePieces(change.value)) {
      const endsLine = piece.endsWith('\n')
      if (kind === 'context') {
        oldBuf += piece
        newBuf += piece
        if (endsLine) emitBoth()
      } else if (kind === 'remove') {
        oldBuf += piece
        oldDirty = true
        if (endsLine) emitOld()
      } else {
        newBuf += piece
        newDirty = true
        if (endsLine) emitNew()
      }
    }
  }
  if (oldBuf !== '' || newBuf !== '' || oldDirty || newDirty) emitBoth()

  return orderRuns(rows)
}

/* ------------------------------------------------------------------ *
 * Hunks
 * ------------------------------------------------------------------ */

function buildHunks(rows: Row[], context: number): Hunk[] {
  const changed: number[] = []
  rows.forEach((row, i) => {
    if (row.type !== 'context') changed.push(i)
  })
  if (changed.length === 0) return []

  const ranges: Array<[number, number]> = []
  for (const idx of changed) {
    const start = Math.max(0, idx - context)
    const end = Math.min(rows.length - 1, idx + context)
    const last = ranges[ranges.length - 1]
    if (last && start <= last[1] + 1) last[1] = Math.max(last[1], end)
    else ranges.push([start, end])
  }

  return ranges.map(([start, end]) => {
    const slice = rows.slice(start, end + 1)
    const oldRows = slice.filter(r => r.type !== 'add')
    const newRows = slice.filter(r => r.type !== 'remove')
    let oldStart = oldRows.length ? oldRows[0].oldNo : 0
    let newStart = newRows.length ? newRows[0].newNo : 0
    // A hunk with no lines on one side anchors to the last line before it.
    if (!oldRows.length) {
      for (let i = start - 1; i >= 0; i--) {
        if (rows[i].type !== 'add') {
          oldStart = rows[i].oldNo
          break
        }
      }
    }
    if (!newRows.length) {
      for (let i = start - 1; i >= 0; i--) {
        if (rows[i].type !== 'remove') {
          newStart = rows[i].newNo
          break
        }
      }
    }
    return {
      rows: slice,
      start,
      end,
      oldStart,
      oldLines: oldRows.length,
      newStart,
      newLines: newRows.length
    }
  })
}

/* ------------------------------------------------------------------ *
 * Renderers
 * ------------------------------------------------------------------ */

function renderUnified(rows: Row[], context: number): string {
  const out: string[] = []
  for (const hunk of buildHunks(rows, context)) {
    out.push(`@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@`)
    for (const row of hunk.rows) {
      const sign = row.type === 'add' ? '+' : row.type === 'remove' ? '-' : ' '
      out.push(sign + stripEol(row.text))
    }
  }
  return out.join('\n')
}

function renderSideBySide(rows: Row[], context: number): string {
  const hunks = buildHunks(rows, context)
  if (hunks.length === 0) return ''

  // Folded rather than spread into Math.max: a hunk can hold hundreds of
  // thousands of rows, and `Math.max(...arr)` overflows the call stack there.
  let widest = 1
  for (const hunk of hunks) {
    for (const row of hunk.rows) {
      if (row.type === 'add') continue
      const w = cpLength(stripEol(row.text))
      if (w > widest) widest = w
      if (widest >= 80) break
    }
    if (widest >= 80) break
  }
  const width = Math.min(80, widest)
  const line = (left: string, marker: string, right: string) =>
    `${padRight(left, width)} ${marker}${right === '' ? '' : ' ' + right}`

  const out: string[] = []
  let cursor = 0
  for (const hunk of hunks) {
    if (hunk.start > cursor) out.push('...')
    let i = 0
    while (i < hunk.rows.length) {
      const row = hunk.rows[i]
      if (row.type === 'context') {
        const text = stripEol(row.text)
        out.push(line(text, ' ', text))
        i++
        continue
      }
      let j = i
      while (j < hunk.rows.length && hunk.rows[j].type !== 'context') j++
      const run = hunk.rows.slice(i, j)
      const removals = run.filter(r => r.type === 'remove')
      const additions = run.filter(r => r.type === 'add')
      const pairs = Math.max(removals.length, additions.length)
      for (let k = 0; k < pairs; k++) {
        const left = removals[k] ? stripEol(removals[k].text) : ''
        const right = additions[k] ? stripEol(additions[k].text) : ''
        const marker = removals[k] && additions[k] ? '|' : removals[k] ? '<' : '>'
        out.push(line(left, marker, right))
      }
      i = j
    }
    cursor = hunk.end + 1
  }
  if (cursor < rows.length) out.push('...')
  return out.join('\n')
}

function renderInline(changes: Change[]): string {
  return changes
    .map(change => (change.added ? `{+${change.value}+}` : change.removed ? `[-${change.value}-]` : change.value))
    .join('')
}

function renderJson(changes: Change[], granularity: Granularity): Record<string, unknown> {
  let added = 0
  let removed = 0
  let unchanged = 0
  const list = changes.map(change => {
    const count = change.count ?? 0
    if (change.added) added += count
    else if (change.removed) removed += count
    else unchanged += count
    return {
      type: change.added ? 'add' : change.removed ? 'remove' : 'equal',
      value: change.value,
      count
    }
  })
  return {
    granularity,
    identical: added === 0 && removed === 0,
    stats: { added, removed, unchanged },
    changes: list
  }
}

/* ------------------------------------------------------------------ *
 * Utility
 * ------------------------------------------------------------------ */

const util: Utility = {
  id: 'text_diff',
  name: 'text diff',
  category: 'Analysis',
  description:
    'Diff the input against a second text by lines, words, or characters and render it as a unified, inline, side-by-side, or JSON diff.',
  accepts: 'string',
  produces: ['string', 'json'],
  tags: ['diff', 'compare text', 'unified diff', 'patch', 'line diff', 'word diff'],
  aliases: ['diff'],
  params: {
    other: { kind: 'file', label: 'other text', default: '', accept: '.txt', as: 'text' },
    granularity: {
      kind: 'select',
      label: 'granularity',
      options: ['lines', 'words', 'characters'],
      default: 'lines'
    },
    format: {
      kind: 'select',
      label: 'format',
      options: ['unified', 'inline', 'side-by-side', 'json'],
      default: 'unified'
    },
    context: { kind: 'number', label: 'context lines', default: 3, min: 0, integer: true, max: 1000 },
    ignoreCase: { kind: 'boolean', label: 'ignore case', default: false },
    ignoreWhitespace: { kind: 'boolean', label: 'ignore whitespace', default: false }
  },
  examples: [
    {
      title: 'one changed line',
      input: 'line one\nline two\n',
      params: { other: 'line one\nline TWO\n' },
      output: '@@ -1,2 +1,2 @@\n line one\n-line two\n+line TWO'
    }
  ],
  apply: async (input: any, params: any) => {
    const granularity = asOption(params?.granularity, GRANULARITIES, 'lines', 'granularity')
    const format: Format = asOption(params?.format, FORMATS, 'unified', 'format')
    const context = Math.max(0, Math.floor(asNumber(params?.context, 3)))
    const ignoreCase = asBool(params?.ignoreCase, false)
    const ignoreWhitespace = asBool(params?.ignoreWhitespace, false)

    const a = String(input ?? '')
    const b = String(params?.other ?? '')

    let changes: Change[] = []
    if (a !== '' || b !== '') {
      const mod = await getDiff()
      const diffFn = pickDiffFn(mod, granularity, ignoreWhitespace)
      changes = diffFn(a, b, diffOptionsFor(granularity, ignoreCase, ignoreWhitespace)) ?? []
    }

    if (format === 'json') return renderJson(changes, granularity)
    if (format === 'inline') return renderInline(changes)
    const rows = buildRows(changes)
    return format === 'side-by-side' ? renderSideBySide(rows, context) : renderUnified(rows, context)
  }
}

export default util
