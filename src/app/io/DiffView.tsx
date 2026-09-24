import React, { useEffect, useRef, useState } from 'react'
import type { Change } from 'diff'

/** Combined size above which the diff is not attempted at all. */
export const MAX_DIFF_CHARS = 500_000
/** diff gives up (reports undefined) after this long, so a pathological pair can't run forever. */
const DIFF_TIMEOUT_MS = 2000
/** Live mode changes both sides on every keystroke; wait for a pause before re-diffing. */
const DEBOUNCE_MS = 120

let diffLinesFn: typeof import('diff').diffLines | null = null
async function loadDiffLines() {
  if (!diffLinesFn) diffLinesFn = (await import('diff')).diffLines
  return diffLinesFn
}

export interface DiffViewProps {
  before: string
  after: string
}

interface Computed {
  before: string
  after: string
  /** null: the diff timed out or failed to load. */
  changes: Change[] | null
}

/** Line diff of input -> output, shown only in side-by-side layout. `diff` is loaded lazily. */
export default function DiffView({ before, after }: DiffViewProps) {
  const tooLarge = before.length + after.length > MAX_DIFF_CHARS
  const [computed, setComputed] = useState<Computed | null>(null)
  const hasDiff = useRef(false)

  useEffect(() => {
    if (tooLarge) return undefined
    let cancelled = false
    const done = (changes: Change[] | null) => {
      if (cancelled) return
      hasDiff.current = true
      setComputed({ before, after, changes })
    }
    // the first diff shows at once; later ones wait for a pause in typing
    const timer = setTimeout(() => {
      loadDiffLines()
        .then(fn => {
          if (cancelled) return
          // callback mode: diff works in slices between macrotasks instead of blocking the page
          fn(before, after, { timeout: DIFF_TIMEOUT_MS, callback: changes => done(changes ?? null) })
        })
        .catch(() => done(null))
    }, hasDiff.current ? DEBOUNCE_MS : 0)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [before, after, tooLarge])

  if (tooLarge) {
    return <div className="muted text-sm" role="status">input and output are too large to diff (over {MAX_DIFF_CHARS.toLocaleString()} characters)</div>
  }
  if (computed === null) return <div className="muted text-sm" role="status">computing diff…</div>
  if (computed.changes === null) {
    return <div className="muted text-sm" role="status">these texts took too long to diff</div>
  }

  // while an edit is being re-diffed, the previous diff stays up (marked busy) instead of flashing
  const stale = computed.before !== before || computed.after !== after
  return (
    <div
      role="region"
      aria-label="input to output diff"
      aria-busy={stale}
      tabIndex={0}
      className={`border rounded-2xl p-3 bg-surface mono text-xs overflow-auto max-h-80 ${stale ? 'opacity-70' : ''}`}
    >
      {computed.changes.map((c, i) => {
        const lines = c.value.split('\n').filter((line, idx, arr) => !(idx === arr.length - 1 && line === ''))
        const prefix = c.added ? '+ ' : c.removed ? '- ' : '  '
        const tone = c.added ? 'text-success bg-success/10' : c.removed ? 'text-danger bg-danger/10' : ''
        return (
          <pre key={i} className={`whitespace-pre-wrap [overflow-wrap:anywhere] m-0 ${tone}`}>
            {lines.map(l => `${prefix}${l}`).join('\n')}
          </pre>
        )
      })}
    </div>
  )
}
