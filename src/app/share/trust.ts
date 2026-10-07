/**
 * Steps that execute user-authored code must never run just because someone opened
 * a link: a shared pipeline could otherwise exfiltrate the viewer's input. Every
 * pipeline arriving from outside (share link, embed, imported file) passes through
 * `quarantineUntrusted` before it reaches the editor.
 */
import type { PipelineStep } from '@/types/utility'
import { isUtilityStep, mapChildSequences, walkSteps } from '@/core/steps'

/** Utility ids whose params contain code that runs. */
export const CODE_UTILITIES = new Set(['custom_js'])

const isCodeStep = (s: PipelineStep) => isUtilityStep(s) && CODE_UTILITIES.has(s.utilityId)

/** Ids of every code-running step, at any depth (branch lanes, macro and "run on each" bodies). */
export function untrustedCodeSteps(steps: PipelineStep[]): string[] {
  const out: string[] = []
  walkSteps(steps, s => { if (isCodeStep(s)) out.push(s.id) })
  return out
}

/**
 * Disable every code-running step; returns the new steps and which were disabled.
 * Walks by step type rather than by id, so it holds even when ids collide.
 */
export function quarantineUntrusted(steps: PipelineStep[]): { steps: PipelineStep[]; quarantined: string[] } {
  const quarantined = untrustedCodeSteps(steps)
  if (!quarantined.length) return { steps, quarantined }
  const walk = (seq: PipelineStep[]): PipelineStep[] =>
    seq.map(s => (isCodeStep(s) ? { ...s, enabled: false } : mapChildSequences(s, walk)))
  return { steps: walk(steps), quarantined }
}
