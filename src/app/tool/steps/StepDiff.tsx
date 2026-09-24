/**
 * Per-step diff preview (§8.10): a line diff between a step's recorded input and
 * output. `diff` is loaded lazily and cached in a module-level variable (never a
 * static import), and each diff is time-boxed so a pathological pair (every line
 * changed) cannot freeze the page on every keystroke.
 */
import React, { useEffect, useMemo, useState } from 'react'
import type { Value } from '@/types/utility'
import { buildDiffRows, prepareDiff, toLineOps, type DiffRow, type PreparedDiff } from './diffRows'

export interface StepDiffProps {
  before: Value
  after: Value
}

/** Myers is O(N·D): give up (and say so) rather than block the main thread longer than this. */
const DIFF_TIMEOUT_MS = 250

type DiffModule = typeof import('diff')
let diffModule: Promise<DiffModule> | null = null
const loadDiff = () => (diffModule ??= import('diff').catch(e => { diffModule = null; throw e }))

/** The async result, tagged with the input it was computed for so a stale one is never shown. */
type Outcome =
  | { for: PreparedDiff; status: 'ready'; rows: DiffRow[] }
  | { for: PreparedDiff; status: 'too-complex' | 'error' }

const note = (text: string, cls = 'muted italic') => <div className={`text-sm ${cls}`}>{text}</div>

export default function StepDiff({ before, after }: StepDiffProps) {
  const prepared = useMemo(() => prepareDiff(before, after), [before, after])
  const [outcome, setOutcome] = useState<Outcome | null>(null)

  useEffect(() => {
    if (prepared.kind !== 'text') return
    let cancelled = false
    loadDiff().then(({ diffLines }) => {
      if (cancelled) return
      const parts = diffLines(prepared.a, prepared.b, { timeout: DIFF_TIMEOUT_MS })
      setOutcome(parts
        ? { for: prepared, status: 'ready', rows: buildDiffRows(toLineOps(parts)) }
        : { for: prepared, status: 'too-complex' })
    }).catch(() => { if (!cancelled) setOutcome({ for: prepared, status: 'error' }) })
    return () => { cancelled = true }
  }, [prepared])

  if (prepared.kind === 'type-mismatch') return note('different value types')
  if (prepared.kind === 'too-large') return note('too large to diff')
  if (prepared.kind === 'same') return note('no textual change')
  if (!outcome || outcome.for !== prepared) return note('diffing…', 'muted')
  if (outcome.status !== 'ready') {
    return outcome.status === 'error' ? note('could not compute diff', 'text-danger') : note('too many changes to diff')
  }

  return (
    <div role="group" aria-label="step diff" className="font-mono text-xs rounded-xl border overflow-auto max-h-80">
      {outcome.rows.map((r, i) => {
        if (r.type === 'collapse') {
          return <div key={i} className="px-2 py-0.5 muted italic">… {r.count} unchanged {r.count === 1 ? 'line' : 'lines'}</div>
        }
        const cls = r.type === 'add' ? 'bg-success/10 text-success' : r.type === 'remove' ? 'bg-danger/10 text-danger' : ''
        const marker = r.type === 'add' ? '+' : r.type === 'remove' ? '-' : ' '
        return (
          <div key={i} className={`px-2 whitespace-pre-wrap [overflow-wrap:anywhere] ${cls}`}>
            {marker} {r.text}
          </div>
        )
      })}
    </div>
  )
}
