/** Run-condition and error-policy chips shared by every kind of step card. */
import React from 'react'
import type { Condition, ErrorPolicy } from '@/types/utility'
import { describeCondition, describeErrorPolicy } from './status'

export interface StepStateChipsProps {
  condition?: Condition
  onError?: ErrorPolicy
}

export default function StepStateChips({ condition, onError }: StepStateChipsProps) {
  const conditionSummary = describeCondition(condition)
  const errorSummary = describeErrorPolicy(onError)
  return (
    <>
      {conditionSummary && <span className="chip" title="run condition">{conditionSummary}</span>}
      {errorSummary && <span className="chip" title="error policy">{errorSummary}</span>}
    </>
  )
}
