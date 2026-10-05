import type {
  Condition, MergeSpec, Params, PipelineStep, RunEnv, StepContext, Utility, Value,
} from '../types/utility'
import { asText, coerceInputFor, isBytes, isEmptyValue, resolveAccepts, valueType } from './coerce'
import { resolveParams, validateParam } from './params'
import { isBranchStep, isMacroStep, isUtilityStep } from './steps'

export type SkipReason = 'disabled' | 'condition' | 'halted' | 'aborted'

export interface StepEvent {
  id: string
  status: 'start' | 'done' | 'error' | 'skipped'
  ms?: number
}

export interface RunOptions {
  /** Resolves a utility id to its implementation (eager map, lazy chunk, …). */
  load: (id: string) => Promise<Utility> | Utility
  /** Record every step's output (and input) for per-step previews. */
  previews?: boolean
  signal?: AbortSignal
  env?: RunEnv
  onStep?: (e: StepEvent) => void
  /** Millisecond clock for timings; defaults to performance.now. */
  clock?: () => number
  /** Largest value any step may produce, in characters or bytes; defaults to MAX_VALUE_SIZE. */
  maxValueSize?: number
}

export interface RunResult {
  out: Value
  /** step id → the step's output (only when `previews`). */
  previews: Record<string, Value>
  /** step id → the step's input (only when `previews`), for per-step diffs. */
  inputs: Record<string, Value>
  /** step id → error message. */
  err: Record<string, string>
  /** step id → milliseconds spent in `apply` (branch/macro: whole subtree). */
  timings: Record<string, number>
  skipped: Record<string, SkipReason>
  /** A top-level step with `onError: 'stop'` failed and halted the pipeline. */
  halted: boolean
  aborted: boolean
}

const defaultClock = () =>
  typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : Date.now()

const message = (e: unknown) => (e as any)?.message || String(e)

/** Regex flags that make `.test` stateful are dropped; unknown letters are rejected by RegExp. */
const conditionFlags = (flags = '') => [...new Set(flags.replace(/[gy]/g, ''))].join('')

export function evalCondition(c: Condition | undefined, v: Value): boolean {
  if (!c) return true
  let r: boolean
  switch (c.kind) {
    case 'nonEmpty': r = !isEmptyValue(v); break
    case 'regex': r = new RegExp(c.pattern, conditionFlags(c.flags)).test(asText(v)); break
    case 'type': r = valueType(v) === c.type; break
    default: r = true
  }
  return c.negate ? !r : r
}

export function mergeOutputs(outs: Value[], merge: MergeSpec): Value {
  switch (merge.mode) {
    case 'pick': {
      if (!Number.isInteger(merge.index) || merge.index < 0 || merge.index >= outs.length) {
        throw new Error(`branch ${merge.index + 1} does not exist (there are ${outs.length})`)
      }
      return outs[merge.index]
    }
    case 'json':
      return outs.map(v => (valueType(v) === 'json' ? v : asText(v)))
    case 'zip': {
      const lines = outs.map(v => asText(v).split('\n'))
      const n = Math.max(0, ...lines.map(l => l.length))
      const rows: string[] = []
      for (let i = 0; i < n; i++) for (const l of lines) if (i < l.length) rows.push(l[i])
      return rows.join(merge.separator ?? '\n')
    }
    default:
      return outs.map(asText).join(merge.separator ?? '\n')
  }
}

interface Ctx {
  opts: RunOptions
  res: RunResult
  clock: () => number
  stepCtx: StepContext
}

function skipAll(steps: PipelineStep[], reason: SkipReason, ctx: Ctx) {
  for (const s of steps) {
    ctx.res.skipped[s.id] = reason
    ctx.opts.onStep?.({ id: s.id, status: 'skipped' })
  }
}

/**
 * Largest value (characters or bytes) a step may produce. Stops amplifying steps
 * (hex-encode six times, a wide branch merge) from compounding past what any host
 * can hold; the step fails and its error policy applies.
 */
export const MAX_VALUE_SIZE = 64 * 1024 * 1024

function sizeOf(v: Value): number {
  if (typeof v === 'string') return v.length
  if (isBytes(v)) return v.length
  // JSON (including a bare null, which valueType reports as 'string') is not measured:
  // serialising it just to measure would cost as much as the risk
  return 0
}

const human = (n: number) =>
  n >= 1048576 ? `${Math.round(n / 1048576)} MB` : n >= 1024 ? `${Math.round(n / 1024)} KB` : `${n} characters`

function checkSize(size: number, ctx: Ctx) {
  const max = ctx.opts.maxValueSize ?? MAX_VALUE_SIZE
  if (size > max) throw new Error(`output is too large (${human(size)}; the limit is ${human(max)})`)
}

/**
 * Declared number/range bounds are enforced, not just displayed: pipelines arrive
 * from share links, and `repeat` with count 1e9 must fail as a step error rather
 * than allocate until the tab dies.
 */
function boundsProblem(util: Utility, params: Params): string | null {
  for (const [key, spec] of Object.entries(util.params ?? {})) {
    // A select value is typically a table key (`ALPHABETS[name]`): one naming an
    // Object.prototype member finds `Object`, `toString`… instead of undefined. Other
    // off-list values stay the utility's business (legacy names, aliases).
    if (spec.kind === 'select' || spec.kind === 'multiselect') {
      const v = params[key]
      const values = Array.isArray(v) ? v : [v]
      const inherited = values.some(x => typeof x === 'string' && x in Object.prototype && !spec.options.includes(x))
      if (inherited) return `${spec.label || key} ${validateParam(spec, v) ?? `must be one of: ${spec.options.join(', ')}`}`
      continue
    }
    if (spec.kind !== 'number' && spec.kind !== 'range') continue
    const problem = validateParam(spec, params[key])
    if (problem) return `${spec.label || key} ${problem}`
  }
  return null
}

async function runStep(step: PipelineStep, input: Value, ctx: Ctx): Promise<Value> {
  if (isUtilityStep(step)) {
    const util = await ctx.opts.load(step.utilityId)
    const coerced = coerceInputFor(input, resolveAccepts(util.accepts, input))
    const params = resolveParams(util, step.params ?? {})
    const problem = boundsProblem(util, params)
    if (problem) throw new Error(problem)
    const t0 = ctx.clock()
    try {
      return await util.apply(coerced, params, ctx.stepCtx)
    } finally {
      ctx.res.timings[step.id] = ctx.clock() - t0
    }
  }
  const t0 = ctx.clock()
  try {
    if (isBranchStep(step)) {
      const outs = (await Promise.all(step.branches.map(b => runSequence(input, b, ctx)))).map(o => o.out)
      // refuse before joining: each lane is within the limit, but merging them all would
      // allocate their sum (plus the merged copy) before the step's output check runs
      const merge = step.merge ?? { mode: 'concat' }
      if (merge.mode !== 'pick') checkSize(outs.reduce((n, o) => n + sizeOf(o), 0), ctx)
      return mergeOutputs(outs, merge)
    }
    if (isMacroStep(step)) return (await runSequence(input, step.steps, ctx)).out
    throw new Error(`unknown step type: ${(step as any).type}`)
  } finally {
    ctx.res.timings[step.id] = ctx.clock() - t0
  }
}

async function runSequence(input: Value, steps: PipelineStep[], ctx: Ctx): Promise<{ out: Value; halted: boolean }> {
  const { res, opts } = ctx
  let out = input
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]
    if (opts.signal?.aborted) {
      res.aborted = true
      skipAll(steps.slice(i), 'aborted', ctx)
      return { out, halted: false }
    }
    if (step.enabled === false) {
      res.skipped[step.id] = 'disabled'
      opts.onStep?.({ id: step.id, status: 'skipped' })
      if (opts.previews) { res.inputs[step.id] = out; res.previews[step.id] = out }
      continue
    }
    if (opts.previews) res.inputs[step.id] = out
    opts.onStep?.({ id: step.id, status: 'start' })
    try {
      if (!evalCondition(step.condition, out)) {
        res.skipped[step.id] = 'condition'
        opts.onStep?.({ id: step.id, status: 'skipped' })
        if (opts.previews) res.previews[step.id] = out
        continue
      }
      const next = await runStep(step, out, ctx)
      checkSize(sizeOf(next), ctx)
      out = next
      if (opts.previews) res.previews[step.id] = out
      opts.onStep?.({ id: step.id, status: 'done', ms: res.timings[step.id] })
    } catch (e) {
      res.err[step.id] = message(e)
      opts.onStep?.({ id: step.id, status: 'error', ms: res.timings[step.id] })
      const policy = step.onError ?? 'passthrough'
      if (policy === 'empty') out = ''
      if (policy === 'stop') {
        skipAll(steps.slice(i + 1), 'halted', ctx)
        return { out, halted: true }
      }
    }
  }
  return { out, halted: false }
}

/**
 * Run `steps` over `source`. Never rejects for a step failure — errors are recorded
 * per step and handled by each step's error policy. Aborting (via `signal`) stops
 * before the next step and reports `aborted: true`.
 */
export async function runPipeline(source: Value, steps: PipelineStep[], opts: RunOptions): Promise<RunResult> {
  const res: RunResult = {
    out: source, previews: {}, inputs: {}, err: {}, timings: {}, skipped: {}, halted: false, aborted: false,
  }
  const ctx: Ctx = {
    opts, res, clock: opts.clock ?? defaultClock,
    stepCtx: { signal: opts.signal, env: opts.env },
  }
  const { out, halted } = await runSequence(source, steps, ctx)
  res.out = out
  res.halted = halted
  return res
}
