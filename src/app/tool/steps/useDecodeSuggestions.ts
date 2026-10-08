/**
 * Decoders that fit a value, found in the background (debounced, cancelled when the
 * value changes) for the empty state and the "add step" row's hint.
 */
import { useEffect, useState } from 'react'
import type { Value } from '@/types/utility'
import { registry } from '@/app/registry'
import { SIZE_GUARD } from '@/app/engine/useRunner'
import { isBytes, isEmptyValue } from '@/core/coerce'
import { suggestDecoders, type Suggestion } from '@/core/detect'

const DEBOUNCE_MS = 300

interface Analysis { value: Value; suggestions: Suggestion[] }

export interface DecodeSuggestions {
  /** Nothing to analyse. */
  empty: boolean
  /** Past the size at which the runner stops running live: not analysed automatically either. */
  tooLarge: boolean
  /** Suggestions for the value as it is now; `null` while they are being worked out (or skipped). */
  suggestions: Suggestion[] | null
}

const sizeOf = (v: Value): number => (typeof v === 'string' ? v.length : isBytes(v) ? v.length : 0)

export function useDecodeSuggestions(value: Value, { limit, enabled = true }: { limit: number; enabled?: boolean }): DecodeSuggestions {
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const empty = isEmptyValue(value)
  const tooLarge = sizeOf(value) > SIZE_GUARD
  const skip = !enabled || empty || tooLarge

  useEffect(() => {
    if (skip) return
    const ctrl = new AbortController()
    const timer = setTimeout(() => {
      suggestDecoders(value, { load: registry.load, limit, signal: ctrl.signal })
        .then(suggestions => { if (!ctrl.signal.aborted) setAnalysis({ value, suggestions }) })
        .catch(() => { if (!ctrl.signal.aborted) setAnalysis({ value, suggestions: [] }) })
    }, DEBOUNCE_MS)
    return () => { ctrl.abort(); clearTimeout(timer) }
  }, [value, skip, limit])

  // only ever show suggestions computed for the value as it is now
  const current = !skip && analysis?.value === value ? analysis.suggestions : null
  return { empty, tooLarge, suggestions: current }
}
