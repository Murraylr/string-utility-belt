/** Display helpers shared by the step, branch and macro cards: condition/error chips and run states. */
import type { Condition, ErrorPolicy } from '@/types/utility'
import type { SkipReason } from '@/core/runner'

/** One-line summary of a run condition, for the card's chip. `null` for the default (always run). */
export function describeCondition(c?: Condition): string | null {
  if (!c) return null
  const not = c.negate ? 'not ' : ''
  switch (c.kind) {
    case 'nonEmpty': return `if ${not}non-empty`
    case 'regex': return `if ${not}matches /${c.pattern}/${c.flags ?? ''}`
    case 'type': return `if ${not}type is ${c.type}`
    case 'always': return c.negate ? 'never runs (negated "always")' : null
    default: return null
  }
}

const ERROR_CHIP: Partial<Record<ErrorPolicy, string>> = {
  stop: 'on error: stop', empty: 'on error: empty output',
}

/** Chip text for a non-default error policy; `undefined` for passthrough (the default). */
export const describeErrorPolicy = (p?: ErrorPolicy): string | undefined => (p ? ERROR_CHIP[p] : undefined)

export const SKIP_LABEL: Record<SkipReason, string> = {
  condition: 'skipped: condition', halted: 'not run: pipeline stopped', aborted: 'not run: aborted', disabled: 'disabled',
}

/** Card tone for a step the last run did not execute (or that failed). */
export function stateToneClass(skipped?: string, error?: string): string {
  if (error) return 'border-danger/60'
  if (skipped === 'halted') return 'border-warn/50 bg-warn/5'
  if (skipped === 'condition') return 'opacity-70'
  if (skipped === 'aborted') return 'opacity-50'
  return ''
}
