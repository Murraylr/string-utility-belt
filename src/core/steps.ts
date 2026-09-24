import type { BranchStep, MacroStep, PipelineStep, UtilityStep } from '../types/utility'

export const isUtilityStep = (s: PipelineStep): s is UtilityStep =>
  (s.type === undefined || s.type === 'utility') && typeof (s as UtilityStep).utilityId === 'string'
export const isBranchStep = (s: PipelineStep): s is BranchStep => s.type === 'branch'
export const isMacroStep = (s: PipelineStep): s is MacroStep => s.type === 'macro'

let counter = 0
/** Unique enough for step ids: random UUID where available, else time + counter. */
export function stepId(prefix = 'step'): string {
  const c = (globalThis as any).crypto
  if (c && typeof c.randomUUID === 'function') return `${prefix}_${c.randomUUID().slice(0, 13)}`
  return `${prefix}_${Date.now().toString(36)}_${(counter++).toString(36)}`
}

/** Direct children of a step (branch lanes flattened, macro body). */
export function childSequences(step: PipelineStep): PipelineStep[][] {
  if (isBranchStep(step)) return step.branches
  if (isMacroStep(step)) return [step.steps]
  return []
}

/** Depth-first visit of every step, nested ones included. Return false to stop. */
export function walkSteps(steps: PipelineStep[], fn: (s: PipelineStep, parents: PipelineStep[]) => void | false,
  parents: PipelineStep[] = []): boolean {
  for (const s of steps) {
    if (fn(s, parents) === false) return false
    for (const seq of childSequences(s)) {
      if (!walkSteps(seq, fn, [...parents, s])) return false
    }
  }
  return true
}

export function findStep(steps: PipelineStep[], id: string): PipelineStep | undefined {
  let found: PipelineStep | undefined
  walkSteps(steps, s => { if (s.id === id) { found = s; return false } })
  return found
}

/** Every utility id used anywhere in the tree. */
export function utilityIds(steps: PipelineStep[]): string[] {
  const ids = new Set<string>()
  walkSteps(steps, s => { if (isUtilityStep(s)) ids.add(s.utilityId) })
  return [...ids]
}

/**
 * Immutably replace the step with `id` by `fn(step)`. `fn` may return an array
 * (splice in several), or null (remove). Nested sequences are searched too.
 */
export function updateStep(steps: PipelineStep[], id: string,
  fn: (s: PipelineStep) => PipelineStep | PipelineStep[] | null): PipelineStep[] {
  let changed = false
  const out: PipelineStep[] = []
  for (const s of steps) {
    if (s.id === id) {
      changed = true
      const r = fn(s)
      if (r === null) continue
      if (Array.isArray(r)) out.push(...r); else out.push(r)
      continue
    }
    if (isBranchStep(s)) {
      const branches = s.branches.map(b => updateStep(b, id, fn))
      if (branches.some((b, i) => b !== s.branches[i])) { changed = true; out.push({ ...s, branches }); continue }
    } else if (isMacroStep(s)) {
      const inner = updateStep(s.steps, id, fn)
      if (inner !== s.steps) { changed = true; out.push({ ...s, steps: inner }); continue }
    }
    out.push(s)
  }
  return changed ? out : steps
}

/** Deep copy with fresh ids everywhere, so a duplicate never collides with its source. */
export function cloneWithNewIds<T extends PipelineStep>(step: T): T {
  const base = { ...step, id: stepId() } as PipelineStep
  if (isUtilityStep(base)) return { ...base, params: structuredCloneSafe(base.params ?? {}) } as T
  if (isBranchStep(base)) return { ...base, branches: base.branches.map(b => b.map(cloneWithNewIds)) } as T
  if (isMacroStep(base)) return { ...base, steps: base.steps.map(cloneWithNewIds) } as T
  return base as T
}

function structuredCloneSafe<T>(v: T): T {
  try { return JSON.parse(JSON.stringify(v)) } catch { return v }
}

/** Number of steps in the tree, nested included. */
export function countSteps(steps: PipelineStep[]): number {
  let n = 0
  walkSteps(steps, () => { n++ })
  return n
}
