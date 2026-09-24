/**
 * Steps that execute user-authored code must never run just because someone opened
 * a link: a shared pipeline could otherwise exfiltrate the viewer's input. Every
 * pipeline arriving from outside (share link, embed, imported file) passes through
 * `quarantineUntrusted` before it reaches the editor.
 */
import type { PipelineStep } from '@/types/utility'
import { isBranchStep, isMacroStep, isUtilityStep } from '@/core/steps'

/** Utility ids whose params contain code that runs. */
export const CODE_UTILITIES = new Set(['custom_js'])

const isCodeStep = (s: PipelineStep) => isUtilityStep(s) && CODE_UTILITIES.has(s.utilityId)
const lanes = (s: PipelineStep): PipelineStep[][] =>
  isBranchStep(s) ? (Array.isArray(s.branches) ? s.branches : []) : isMacroStep(s) && Array.isArray(s.steps) ? [s.steps] : []

export function untrustedCodeSteps(steps: PipelineStep[]): string[] {
  const out: string[] = []
  const visit = (seq: PipelineStep[]) => {
    for (const s of seq) {
      if (isCodeStep(s)) out.push(s.id)
      else lanes(s).forEach(visit)
    }
  }
  visit(steps)
  return out
}

/**
 * Disable every code-running step; returns the new steps and which were disabled.
 * Walks by step type rather than by id, so it holds even when ids collide.
 */
export function quarantineUntrusted(steps: PipelineStep[]): { steps: PipelineStep[]; quarantined: string[] } {
  const quarantined = untrustedCodeSteps(steps)
  if (!quarantined.length) return { steps, quarantined }
  const walk = (seq: PipelineStep[]): PipelineStep[] => seq.map(s => {
    if (isCodeStep(s)) return { ...s, enabled: false }
    if (isBranchStep(s)) return { ...s, branches: lanes(s).map(walk) }
    if (isMacroStep(s)) return { ...s, steps: walk(lanes(s)[0] ?? []) }
    return s
  })
  return { steps: walk(steps), quarantined }
}
