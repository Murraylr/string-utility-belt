/**
 * Builders for `recipe.ts` files, so a recipe reads as a list of steps rather
 * than a wall of `{ id, utilityId, enabled, params }` objects. Every builder
 * returns plain step data: what the engine, share links and the library store.
 */
import type { Condition, ErrorPolicy, MergeSpec, PipelineStep, SplitSpec, UtilityStep } from '../types/utility'
import type { RecipeStep } from './types'

export interface StepOptions {
  /** Run the step only when its input matches; otherwise the input passes through. */
  condition?: Condition
  onError?: ErrorPolicy
  /** A name for the step in the editor, when the utility's own name says too little. */
  label?: string
}

/** A regex condition's flags spelled out, as `sanitizeSteps` stores them, so share links round-trip unchanged. */
const normalized = (c: Condition): Condition => (c.kind === 'regex' ? { ...c, flags: c.flags ?? '' } : c)

const options = ({ condition, onError, label }: StepOptions): StepOptions => ({
  ...(label ? { label } : {}),
  ...(condition ? { condition: normalized(condition) } : {}),
  ...(onError ? { onError } : {}),
})

/** A top-level utility step and the reason it is in the recipe. */
export function step(id: string, utilityId: string, params: Record<string, unknown>, why: string, opts: StepOptions = {}): RecipeStep {
  return { id, utilityId, enabled: true, params, ...options(opts), why }
}

/** A utility step inside a branch lane or a "run on each" body (nested steps carry no reasons: their container has one). */
export function laneStep(id: string, utilityId: string, params: Record<string, unknown> = {}, opts: StepOptions = {}): UtilityStep {
  return { id, utilityId, enabled: true, params, ...options(opts) }
}

/** A top-level branch: every lane runs on the same input and the outputs are merged. */
export function branch(id: string, lanes: PipelineStep[][], merge: MergeSpec, why: string, opts: StepOptions = {}): RecipeStep {
  return { id, type: 'branch', enabled: true, branches: lanes, merge, ...options(opts), why }
}

export interface EachOptions extends StepOptions {
  /** Run the steps on empty items too; by default empty lines and values are left as they are. */
  includeEmpty?: boolean
}

/**
 * A top-level "run on each" step: `steps` run on every item of the input, split per
 * `split`, and each result goes back where its item came from. `onError` decides what
 * an item whose steps fail becomes.
 */
export function each(id: string, split: SplitSpec, steps: PipelineStep[], why: string, opts: EachOptions = {}): RecipeStep {
  return { id, type: 'each', enabled: true, split, skipEmpty: !opts.includeEmpty, steps, ...options(opts), why }
}
