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
  /** CSS max-height of the scrolling diff. */
  maxHeight?: string
}

interface Computed {
  before: string
  after: string
  /** null: the diff timed out or failed to load. */
  changes: Change[] | null
}

const NOTE_CLASS = 'px-4 py-3 min-h-[280px] text-[12.5px] text-muted'

/** Line diff of input -> output, one row per line marked +/-. `diff` is loaded lazily. */
export default function DiffView({ before, after, maxHeight = '20rem' }: DiffViewProps) {
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
    return <div className={NOTE_CLASS} role="status">The input and output are too large to diff (over {MAX_DIFF_CHARS.toLocaleString()} characters).</div>
  }
  if (computed === null) return <div className={NOTE_CLASS} role="status">Computing diff…</div>
  if (computed.changes === null) {
    return <div className={NOTE_CLASS} role="status">These texts took too long to diff.</div>
  }

  // while an edit is being re-diffed, the previous diff stays up (marked busy) instead of flashing
  const stale = computed.before !== before || computed.after !== after
  return (
    <div
      role="region"
      aria-label="input to output diff"
      aria-busy={stale}
      tabIndex={0}
      className={`py-2 min-h-[280px] overflow-auto font-mono text-[12.5px] leading-5 ${stale ? 'opacity-70' : ''}`}
      style={{ maxHeight }}
    >
      {computed.changes.flatMap((c, i) => {
        const lines = c.value.split('\n').filter((line, idx, arr) => !(idx === arr.length - 1 && line === ''))
        const sign = c.added ? '+' : c.removed ? '-' : ''
        const tone = c.added ? 'bg-add-bg text-add-ink' : c.removed ? 'bg-del-bg text-del-ink' : ''
        return lines.map((line, j) => (
          <div key={`${i}:${j}`} className={`flex gap-2.5 px-3.5 ${tone}`}>
            <span className="w-2.5 shrink-0 select-none">{sign}</span>
            <span className="whitespace-pre-wrap wrap-anywhere min-w-0">{line}</span>
          </div>
        ))
      })}
    </div>
  )
}
