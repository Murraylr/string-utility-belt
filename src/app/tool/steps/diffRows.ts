/** Pure helpers behind StepDiff: what text to diff for a pair of values, and how to lay out the result. */
import type { Value } from '@/types/utility'
import { asText, valueType } from '@/core/coerce'

export interface DiffRow {
  type: 'add' | 'remove' | 'ctx' | 'collapse'
  text?: string
  count?: number
}

export interface LineOp { type: 'add' | 'remove' | 'ctx'; text: string }

export const CONTEXT = 3
/** Per-side cap, in UTF-8 bytes (raw bytes for byte values). */
export const MAX_DIFF_BYTES = 200 * 1024

/** True when `s` is longer than `max` UTF-8 bytes, without encoding it when the length alone decides. */
export function utf8Exceeds(s: string, max = MAX_DIFF_BYTES): boolean {
  if (s.length > max) return true // every UTF-16 unit is at least one UTF-8 byte
  if (s.length * 3 <= max) return false // …and at most three
  return new TextEncoder().encode(s).length > max
}

const hex = (b: number) => b.toString(16).padStart(2, '0')

/** 16 bytes per line, space-separated hex — a line diff of this is a readable byte diff. */
export function hexLines(bytes: Uint8Array): string {
  const lines: string[] = []
  for (let i = 0; i < bytes.length; i += 16) lines.push(Array.from(bytes.subarray(i, i + 16), hex).join(' '))
  return lines.join('\n')
}

function strictUtf8(bytes: Uint8Array): string | null {
  try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes) } catch { return null }
}

export type PreparedDiff =
  | { kind: 'type-mismatch' | 'too-large' | 'same' }
  | { kind: 'text'; a: string; b: string }

/**
 * Decide how to diff `before` → `after`. Bytes diff as text only when both sides are
 * valid UTF-8; otherwise as hex, since lossy decoding (U+FFFD) would hide real changes.
 */
export function prepareDiff(before: Value, after: Value): PreparedDiff {
  const type = valueType(before)
  if (type !== valueType(after)) return { kind: 'type-mismatch' }
  let a: string
  let b: string
  if (type === 'bytes') {
    const x = before as Uint8Array
    const y = after as Uint8Array
    if (x.length > MAX_DIFF_BYTES || y.length > MAX_DIFF_BYTES) return { kind: 'too-large' }
    const tx = strictUtf8(x)
    const ty = tx === null ? null : strictUtf8(y)
    if (tx !== null && ty !== null) { a = tx; b = ty } else { a = hexLines(x); b = hexLines(y) }
  } else {
    a = asText(before)
    b = asText(after)
    if (utf8Exceeds(a) || utf8Exceeds(b)) return { kind: 'too-large' }
  }
  return a === b ? { kind: 'same' } : { kind: 'text', a, b }
}

/** Split a diff part's `value` into individual lines, dropping the trailing empty line a `\n` split leaves behind. */
function splitLines(value: string): string[] {
  const lines = value.split('\n')
  if (lines.length && lines[lines.length - 1] === '' && value.endsWith('\n')) lines.pop()
  return lines
}

export function toLineOps(parts: Array<{ value: string; added?: boolean; removed?: boolean }>): LineOp[] {
  const ops: LineOp[] = []
  for (const p of parts) {
    const type: LineOp['type'] = p.added ? 'add' : p.removed ? 'remove' : 'ctx'
    for (const text of splitLines(p.value)) ops.push({ type, text })
  }
  return ops
}

/**
 * Collapse long unchanged runs to `context` lines of context at each edge (fewer at
 * the very start/end, where only one side borders a change).
 */
export function buildDiffRows(ops: LineOp[], context = CONTEXT): DiffRow[] {
  const rows: DiffRow[] = []
  let i = 0
  while (i < ops.length) {
    const op = ops[i]
    if (op.type !== 'ctx') { rows.push(op); i++; continue }
    let j = i
    const run: LineOp[] = []
    while (j < ops.length && ops[j].type === 'ctx') { run.push(ops[j]); j++ }
    const isFirst = i === 0
    const isLast = j === ops.length
    if (isFirst && isLast) {
      rows.push(...run) // the whole diff is unchanged
    } else if (isFirst) {
      if (run.length <= context) rows.push(...run)
      else { rows.push({ type: 'collapse', count: run.length - context }); rows.push(...run.slice(-context)) }
    } else if (isLast) {
      if (run.length <= context) rows.push(...run)
      else { rows.push(...run.slice(0, context)); rows.push({ type: 'collapse', count: run.length - context }) }
    } else if (run.length <= context * 2) {
      rows.push(...run)
    } else {
      rows.push(...run.slice(0, context))
      rows.push({ type: 'collapse', count: run.length - context * 2 })
      rows.push(...run.slice(-context))
    }
    i = j
  }
  return rows
}
