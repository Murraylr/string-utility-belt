/**
 * Runs magic auto-detect against a value: live single-step suggestions (only while
 * `active`, so a closed popover does no work) plus an on-demand "decode all the way".
 */
import { useCallback, useEffect, useState } from 'react'
import type { Value } from '@/types/utility'
import { isEmptyValue } from '@/core/coerce'
import { autoDecode, suggestDecoders, type AutoDecodeResult, type Suggestion } from '@/core/detect'
import { registry } from '@/app/registry'

export interface MagicState {
  loading: boolean
  suggestions: Suggestion[]
  error: string | null
}

export interface MagicApi extends MagicState {
  /** Runs the full auto-decode chain; does not mutate the pipeline itself. */
  decodeAll: (signal?: AbortSignal) => Promise<AutoDecodeResult>
}

interface Analysis { value: Value; suggestions: Suggestion[]; error: string | null }

const NONE: Suggestion[] = []

/**
 * `active` gates analysis so it only runs while something is showing it (e.g. an open
 * popover). Results are tagged with the value they were computed for, so a stale list
 * is never returned for a newer value: `loading` is derived as "active, non-empty and
 * no analysis of *this* value yet".
 */
export function useMagic(value: Value, active: boolean): MagicApi {
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const empty = isEmptyValue(value)

  useEffect(() => {
    if (!active || empty) return
    const ctrl = new AbortController()
    suggestDecoders(value, { load: registry.load, limit: 5, signal: ctrl.signal })
      .then(suggestions => {
        if (!ctrl.signal.aborted) setAnalysis({ value, suggestions, error: null })
      })
      .catch((e: unknown) => {
        if (!ctrl.signal.aborted) setAnalysis({ value, suggestions: NONE, error: (e as Error)?.message || String(e) })
      })
    return () => ctrl.abort()
  }, [value, active, empty])

  const decodeAll = useCallback(
    (signal?: AbortSignal) => autoDecode(value, { load: registry.load, maxDepth: 8, signal }),
    [value]
  )

  const current = analysis && analysis.value === value ? analysis : null
  return {
    loading: active && !empty && !current,
    suggestions: current?.suggestions ?? NONE,
    error: current?.error ?? null,
    decodeAll,
  }
}
