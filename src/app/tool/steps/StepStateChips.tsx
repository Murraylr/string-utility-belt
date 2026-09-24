/** Timing, run-state, condition and error-policy chips shared by every kind of step card. */
import React from 'react'
import type { Condition, ErrorPolicy } from '@/types/utility'
import type { SkipReason } from '@/core/runner'
import { SKIP_LABEL, describeCondition, describeErrorPolicy } from './status'

/** Steps slower than this get a warn-coloured timing chip. */
const SLOW_MS = 100

export interface StepStateChipsProps {
  condition?: Condition
  onError?: ErrorPolicy
  /** Milliseconds from the last run. */
  ms?: number
  skipped?: SkipReason | string
}

export default function StepStateChips({ condition, onError, ms, skipped }: StepStateChipsProps) {
  const conditionSummary = describeCondition(condition)
  const errorSummary = describeErrorPolicy(onError)
  const skipLabel = skipped ? SKIP_LABEL[skipped as SkipReason] : undefined
  return (
    <>
      {ms !== undefined && (
        <span className={`chip tabular-nums ${ms > SLOW_MS ? 'text-warn border-warn/40' : ''}`} title="time spent in this step">
          {ms < 1 ? '<1' : Math.round(ms)} ms
        </span>
      )}
      {skipLabel && <span className="chip">{skipLabel}</span>}
      {conditionSummary && <span className="chip" title="run condition">{conditionSummary}</span>}
      {errorSummary && <span className="chip" title="error policy">{errorSummary}</span>}
    </>
  )
}
