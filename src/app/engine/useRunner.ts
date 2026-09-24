import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PipelineStep, Value } from '@/types/utility'
import { isBytes } from '@/core/coerce'
import { usePref } from '@/app/prefs'
import { execute, type ExecResult, type ExecWhere } from './executor'
import { previewWindow } from './previewWindow'

/** Runs slower than this get debounced while the user types. */
export const SLOW_RUN_MS = 60
/** Adaptive debounce bounds: clamp(lastMs * 2, MIN, MAX). */
export const DEBOUNCE_MIN_MS = 60
export const DEBOUNCE_MAX_MS = 800
/** Above this many characters/bytes, live auto-run pauses until an explicit Run. */
export const SIZE_GUARD = 1_000_000

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n))

export interface LargeInputInfo {
  size: number
  /** True while a live run is being held back because of this size (see SIZE_GUARD). */
  paused: boolean
}

export interface RunState {
  /** The last completed run; `result.partial` mirrors `partial` below. */
  result: ExecResult | null
  running: boolean
  /** Wall-clock duration of the last completed run. */
  ms: number
  /** An unexpected executor failure (step errors live in result.err). */
  failure: string | null
  /** Where the last completed run executed. */
  where: ExecWhere | null
  /** True when the last run saw a prefix of the input, not all of it (see 'previewLimit'). */
  partial: boolean
  largeInput: LargeInputInfo | null
}

export interface RunnerOptions {
  previews: boolean
  /** Live mode re-runs on every change; manual mode only on runNow(). */
  live?: boolean
}

const inputSize = (v: Value): number =>
  typeof v === 'string' ? v.length : isBytes(v) ? (v as Uint8Array).length : 0

const sameLarge = (a: LargeInputInfo | null, b: LargeInputInfo | null) =>
  a === b || (!!a && !!b && a.size === b.size && a.paused === b.paused)

/**
 * Re-runs the pipeline whenever input or steps change. A newer run aborts the older
 * one, so stale results never overwrite fresh ones. After a slow run, later live runs
 * are debounced (longer the slower the last run was) so typing stays responsive;
 * `runNow()` is never debounced. Input over `SIZE_GUARD` pauses live auto-run (an
 * explicit `runNow()` still works) — unless the 'previewLimit' pref is on, in which
 * case live runs see only a 64 KB prefix (cheap at any size) and are marked `partial`.
 * `runNow()` always sees the full input.
 */
export function useRunner(input: Value, steps: PipelineStep[], opts: RunnerOptions) {
  const live = opts.live ?? true
  const [previewLimit] = usePref('previewLimit', false)
  const [state, setState] = useState<RunState>({
    result: null, running: false, ms: 0, failure: null, where: null, partial: false, largeInput: null,
  })
  const lastMs = useRef(0)
  const [token, setToken] = useState(0)
  const manualToken = useRef(0)

  const runNow = useCallback(() => setToken(t => t + 1), [])

  const size = useMemo(() => inputSize(input), [input])
  const oversize = size > SIZE_GUARD

  useEffect(() => {
    // an explicit runNow() always runs, live or not, oversized or not
    const isManualRun = token !== manualToken.current
    manualToken.current = token

    const willRunLive = live && (!oversize || previewLimit)
    const largeInput = oversize ? { size, paused: live && !willRunLive } : null
    const shouldRun = isManualRun || willRunLive

    // reflect the size guard right away (not after a debounced run), and clear
    // `running` when this change superseded an in-flight run without starting one
    setState(s => (sameLarge(s.largeInput, largeInput) && (shouldRun || !s.running)
      ? s
      : { ...s, largeInput, running: shouldRun && s.running }))
    if (!shouldRun) return

    let runInput = input
    let partial = false
    if (!isManualRun && previewLimit) {
      const window = previewWindow(input)
      if (window.cut) { runInput = window.value; partial = true }
    }

    const ac = new AbortController()
    const slow = !isManualRun && lastMs.current > SLOW_RUN_MS
    const delay = slow ? clamp(lastMs.current * 2, DEBOUNCE_MIN_MS, DEBOUNCE_MAX_MS) : 0
    const timer = setTimeout(async () => {
      setState(s => ({ ...s, running: true }))
      const t0 = performance.now()
      try {
        const result = await execute(runInput, steps, { previews: opts.previews, signal: ac.signal })
        if (ac.signal.aborted) return
        const ms = performance.now() - t0
        lastMs.current = ms
        setState({ result: { ...result, partial }, running: false, ms, failure: null, where: result.where, partial, largeInput })
      } catch (e: any) {
        if (ac.signal.aborted) return
        setState(s => ({ ...s, running: false, failure: e?.message || String(e) }))
      }
    }, delay)
    return () => { clearTimeout(timer); ac.abort() }
  }, [input, steps, opts.previews, live, token, oversize, size, previewLimit])

  return useMemo(() => ({ ...state, runNow }), [state, runNow])
}
