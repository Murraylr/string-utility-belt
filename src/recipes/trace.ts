/**
 * A recipe's worked example as the page shows it: every top-level step's output,
 * and what the final output becomes when each step is left out. The build runs
 * it in Node and embeds the result in the pre-rendered page (`#recipe-trace`), so
 * the page needs no run on load; the app runs the same code in the browser when
 * there is no embedded trace (an in-app navigation) or the input changes.
 *
 * Framework-free and engine-agnostic: the caller passes the function that runs a
 * pipeline (the static registry at build time, the worker executor in the app).
 */
import type { PipelineStep, Value } from '../types/utility'
import type { RunResult } from '../core/runner'
import { formatForDisplay, isBytes, valueType } from '../core/coerce'
import { walkSteps } from '../core/steps'
import { toPipelineSteps, type Recipe, type RecipeSample } from './types'

/** Runs `steps` over `input`; with `previews`, every step's output is recorded. */
export type PipelineRunner = (input: Value, steps: PipelineStep[], previews: boolean) => Promise<RunResult>

/** Longest step output shown on the page, in characters and in lines. */
export const PREVIEW_MAX_CHARS = 1200
export const PREVIEW_MAX_LINES = 24
/** Bytes are shown as hex, this many of them. */
export const PREVIEW_BYTES = 48

/** One value as the page shows it, cut to fit. */
export interface Preview {
  kind: 'text' | 'json' | 'bytes'
  /** Text and JSON as `formatForDisplay` renders them; bytes as space-separated hex. */
  text: string
  /** Characters (text, JSON) or bytes in the whole value. */
  size: number
  /** `text` is a prefix of the value. */
  truncated: boolean
}

export interface StepTrace {
  id: string
  /** The step's output; when its condition did not match, its unchanged input. */
  output?: Preview
  /** The first error in this step (or inside its lanes). */
  error?: string
  /** The condition did not match, so the input passed through untouched. */
  skipped?: boolean
}

export interface SkipTrace {
  id: string
  /** The final output with this step left out (absent when that run fails). */
  output?: Preview
  /** The first step that fails with this one left out, and its message. */
  error?: { stepId: string; message: string }
  /** Leaving the step out changes nothing for this input: it is there for other inputs. */
  unchanged: boolean
}

export interface RecipeTrace {
  slug: string
  sampleId: string
  /** The whole output, as `formatForDisplay` renders it. */
  output: string
  steps: StepTrace[]
  skip: SkipTrace[]
}

function clip(text: string): { text: string; truncated: boolean } {
  let end = text.length
  let lines = 0
  for (let i = 0; i < text.length && i < end; i++) {
    if (text[i] === '\n' && ++lines === PREVIEW_MAX_LINES) end = i
  }
  end = Math.min(end, PREVIEW_MAX_CHARS)
  return end < text.length ? { text: text.slice(0, end), truncated: true } : { text, truncated: false }
}

export function preview(v: Value): Preview {
  if (isBytes(v)) {
    const shown = Array.from(v.subarray(0, PREVIEW_BYTES), b => b.toString(16).padStart(2, '0')).join(' ')
    return { kind: 'bytes', text: shown, size: v.length, truncated: v.length > PREVIEW_BYTES }
  }
  const full = formatForDisplay(v)
  return { kind: valueType(v) === 'json' ? 'json' : 'text', ...clip(full), size: full.length }
}

/** The first failing step, in pipeline order (nested steps included). */
export function firstError(result: Pick<RunResult, 'err'>, steps: PipelineStep[]): { stepId: string; message: string } | undefined {
  let found: { stepId: string; message: string } | undefined
  walkSteps(steps, s => {
    const message = result.err[s.id]
    if (message === undefined) return
    found = { stepId: s.id, message }
    return false
  })
  return found
}

/** Each top-level step's output in a run made with previews. */
export function stepTraces(steps: PipelineStep[], result: RunResult): StepTrace[] {
  return steps.map(s => {
    const error = firstError(result, [s])?.message
    const out = result.previews[s.id]
    const skipped = result.skipped[s.id] === 'condition'
    return {
      id: s.id,
      ...(out !== undefined && !error ? { output: preview(out) } : {}),
      ...(error !== undefined ? { error } : {}),
      ...(skipped ? { skipped } : {}),
    }
  })
}

/** `steps` with the top-level step at `index` disabled. */
export function without(steps: PipelineStep[], index: number): PipelineStep[] {
  return steps.map((s, i) => (i === index ? { ...s, enabled: false } : s))
}

/** What leaving out each top-level step does to `input`'s final output (`output` being the full run's). */
export async function skipTraces(steps: PipelineStep[], input: Value, output: string, run: PipelineRunner): Promise<SkipTrace[]> {
  const out: SkipTrace[] = []
  for (let i = 0; i < steps.length; i++) {
    const less = without(steps, i)
    const result = await run(input, less, false)
    const error = firstError(result, less)
    out.push(error
      ? { id: steps[i].id, error, unchanged: false }
      : { id: steps[i].id, output: preview(result.out), unchanged: formatForDisplay(result.out) === output })
  }
  return out
}

/** The page's worked example for `sample` (by default the recipe's first). */
export async function traceRecipe(recipe: Recipe, run: PipelineRunner, sample: RecipeSample = recipe.samples[0]): Promise<RecipeTrace> {
  const steps = toPipelineSteps(recipe.steps)
  const result = await run(sample.input, steps, true)
  const output = formatForDisplay(result.out)
  return {
    slug: recipe.slug,
    sampleId: sample.id,
    output,
    steps: stepTraces(steps, result),
    skip: await skipTraces(steps, sample.input, output, run),
  }
}

/** Element id of the trace a pre-rendered page embeds as JSON. */
export const TRACE_ELEMENT_ID = 'recipe-trace'
