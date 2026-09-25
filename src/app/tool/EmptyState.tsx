import React, { useEffect, useState } from 'react'
import type { Value } from '@/types/utility'
import { useTool } from '@/app/ToolContext'
import { registry } from '@/app/registry'
import { trackUtilityAdd } from '@/app/analytics/analytics'
import { SIZE_GUARD } from '@/app/engine/useRunner'
import { isBytes, isEmptyValue } from '@/core/coerce'
import { suggestDecoders, type Suggestion } from '@/core/detect'
import { seededParams } from '@/app/magic/seed'
import SuggestionButton from '@/app/magic/SuggestionButton'

const DEBOUNCE_MS = 300
const MAX_SUGGESTIONS = 3

export interface EmptyStateProps {
  /** Opens the utility picker; that UI state belongs to the page, not this component. */
  onAddUtility: () => void
}

interface Analysis { input: Value; suggestions: Suggestion[] }

const sizeOf = (v: Value): number => (typeof v === 'string' ? v.length : isBytes(v) ? v.length : 0)

/** Shown by `ToolPage` instead of the step list while the pipeline has no steps. */
export default function EmptyState({ onAddUtility }: EmptyStateProps) {
  const { input, dispatch } = useTool()
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const empty = isEmptyValue(input)
  // same threshold at which the runner stops running live: this analysis is automatic too
  const tooLarge = sizeOf(input) > SIZE_GUARD
  const skip = empty || tooLarge

  useEffect(() => {
    if (skip) return
    const ctrl = new AbortController()
    const timer = setTimeout(() => {
      suggestDecoders(input, { load: registry.load, limit: MAX_SUGGESTIONS, signal: ctrl.signal })
        .then(suggestions => { if (!ctrl.signal.aborted) setAnalysis({ input, suggestions }) })
        .catch(() => { if (!ctrl.signal.aborted) setAnalysis({ input, suggestions: [] }) })
    }, DEBOUNCE_MS)
    return () => { ctrl.abort(); clearTimeout(timer) }
  }, [input, skip])

  // only ever show suggestions computed for the input as it is now
  const current = !skip && analysis?.input === input ? analysis : null
  const suggestions = current?.suggestions ?? []
  const n = suggestions.length

  const pick = (s: Suggestion) => {
    dispatch({ type: 'ADD_STEP', utilityId: s.step.utilityId, params: seededParams(s.step) })
    trackUtilityAdd(s.step.utilityId, 'suggestion')
  }

  const browsePresets = () => window.dispatchEvent(new CustomEvent('sub:open-presets'))

  let status: React.ReactNode
  if (empty) status = "Paste something and we'll suggest a pipeline"
  else if (tooLarge) status = 'This input is too large to analyse automatically — add a utility, or try Magic.'
  else if (!current) status = 'Looking for a pipeline that fits…'
  else if (n > 0) {
    status = (
      <>
        A few things this could be:
        <span className="sr-only"> {n} suggestion{n === 1 ? '' : 's'}</span>
      </>
    )
  } else status = 'No obvious decoding for this input — add a utility or start from a preset.'

  return (
    <div className="card p-8 grid gap-4 text-center justify-items-center">
      <p role="status" aria-live="polite" className="muted">{status}</p>

      {n > 0 && (
        <ul className="grid gap-2 text-left w-full max-w-md" aria-label="suggested first steps">
          {suggestions.map((s, i) => (
            <li key={`${s.step.utilityId}:${i}`}>
              <SuggestionButton suggestion={s} onPick={pick} />
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center justify-center gap-2">
        <button type="button" className="btn" onClick={browsePresets}>Browse presets</button>
        <button type="button" className="cta" onClick={onAddUtility}>Add a utility</button>
      </div>
    </div>
  )
}
