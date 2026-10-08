/** Display helpers shared by the step, branch, macro and "run on each" cards: chips, notes and run states. */
import type { Accepts, Condition, ErrorPolicy, ValueType } from '@/types/utility'
import type { SkipReason } from '@/core/runner'
import { typesOf } from '@/core/coerce'

/** One-line summary of a run condition, for the card's chip. `null` for the default (always run). */
export function describeCondition(c?: Condition): string | null {
  if (!c) return null
  const when = c.negate ? 'unless' : 'if'
  switch (c.kind) {
    case 'nonEmpty': return c.negate ? 'if empty' : 'if not empty'
    case 'regex': return `${when} /${c.pattern}/${c.flags ?? ''}`
    case 'type': return `${when} ${typeLabel(c.type)}`
    case 'always': return c.negate ? 'never runs' : null
    default: return null
  }
}

const ERROR_CHIP: Partial<Record<ErrorPolicy, string>> = {
  stop: 'stops on error', empty: 'empty on error',
}

/** Chip text for a non-default error policy; `undefined` for passthrough (the default). */
export const describeErrorPolicy = (p?: ErrorPolicy): string | undefined => (p ? ERROR_CHIP[p] : undefined)

/** What the run did with a failed step, shown after its error message. */
export const POLICY_NOTE: Record<ErrorPolicy, string> = {
  passthrough: 'Passed its input on unchanged.',
  stop: 'The pipeline stopped here.',
  empty: 'Passed on an empty value.',
}

/** Why the last run did not execute a step, as the note under its card. */
export const SKIP_NOTE: Record<SkipReason, string> = {
  disabled: 'Off. Its input passes through unchanged.',
  condition: 'Skipped: the run condition wasn’t met, so the input passed through.',
  halted: 'Not run: the pipeline stopped at an earlier step.',
  aborted: 'Not run: the run was cancelled.',
}

/** Value types as the UI names them: a string is "text". */
export const typeLabel = (t: ValueType): string => (t === 'string' ? 'text' : t)

/** A utility's `accepts → produces`, e.g. `text → bytes`. */
export const signatureOf = (meta: { accepts?: Accepts; produces?: Accepts }): string =>
  `${typesOf(meta.accepts).map(typeLabel).join('|')} → ${typesOf(meta.produces).map(typeLabel).join('|')}`

/** Steps slower than this get a warn-coloured timing. */
export const SLOW_MS = 100

/** A step's run time, as the card shows it. */
export const formatMs = (ms: number): string => `${ms < 1 ? '<1' : Math.round(ms)} ms`

/** Card border for a step that failed or that the last run stopped before. */
export function stateToneClass(skipped?: string, error?: string): string {
  if (error) return 'border-danger-line'
  if (skipped === 'halted') return 'border-warn/50'
  return 'border-line'
}
