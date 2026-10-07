import type {
  Condition, EachStep, MergeSpec, Params, PipelineStep, RunEnv, StepContext, Utility, Value,
} from '../types/utility'
import { asText, coerceInputFor, isBytes, isEmptyValue, resolveAccepts, valueType } from './coerce'
import { resolveParams, validateParam } from './params'
import { itemNoun, splitItems } from './split'
import { isBranchStep, isEachStep, isMacroStep, isUtilityStep, walkSteps } from './steps'

export type SkipReason = 'disabled' | 'condition' | 'halted' | 'aborted'

/**
 * A step starting or finishing. Steps inside a "run on each" step report once, after
 * every item has run (no `start`), with the time summed over items and the outcome of
 * the item the result's previews show (see `ItemStats.sample`).
 */
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
  /** Items "run on each" steps may process in one run, nested ones included; defaults to MAX_EACH_ITEMS. */
  maxEachItems?: number
  /**
   * Gives the host a turn (a macrotask) so it can deliver a cancel while a "run on
   * each" step works through its items; called at most every EACH_SLICE_MS. Defaults
   * to a zero-delay timeout.
   */
  yieldToHost?: () => Promise<void>
}

/** How a "run on each" step's items went. */
export interface ItemStats {
  /** Items the input was split into. */
  total: number
  /** Items whose steps ran (the rest were empty and left as they were). */
  ran: number
  /** Items where a nested step failed. */
  failed: number
  /**
   * The item the nested steps' previews, inputs, errors and skips describe — the first
   * that failed, else the first that ran (`line 4`, `[3]`, `"apiKey"`). Absent when no item ran.
   */
  sample?: string
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
  /** step id → item counts, for "run on each" steps that split their input. */
  items?: Record<string, ItemStats>
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

/** State one run shares across every nested context. */
interface Shared {
  /** Items "run on each" steps have taken so far. */
  items: number
  /** Real time of the last yield to the host. */
  lastYield: number
}

interface Ctx {
  opts: RunOptions
  res: RunResult
  clock: () => number
  stepCtx: StepContext
  shared: Shared
}

/** A "run on each" step stopped between items because the run was aborted. */
class RunAborted extends Error {
  constructor() { super('aborted') }
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
    if (isEachStep(step)) return await runEach(step, input, ctx)
    throw new Error(`unknown step type: ${(step as any).type}`)
  } finally {
    ctx.res.timings[step.id] = ctx.clock() - t0
  }
}

/**
 * Items one run may hand to "run on each" steps, nested ones included, so a huge
 * file split into lines, or an each nested in another, cannot turn one run into
 * unbounded work. `maxEachItems` overrides it.
 */
export const MAX_EACH_ITEMS = 100_000

/** Longest a "run on each" step works through items before giving the host a turn. */
export const EACH_SLICE_MS = 20

const macrotask = () => new Promise<void>(resolve => setTimeout(resolve, 0))

const own = (o: object, key: string) => Object.prototype.hasOwnProperty.call(o, key)

/** `load`, resolved once per utility id: an each step asks for the same utilities for every item. */
function memoLoad(load: RunOptions['load']): RunOptions['load'] {
  const cache = new Map<string, Promise<Utility>>()
  return id => {
    let p = cache.get(id)
    if (!p) {
      // via then(): a load that throws synchronously becomes a rejection the step records
      p = Promise.resolve().then(() => load(id))
      cache.set(id, p)
    }
    return p
  }
}

const freshResult = (out: Value): RunResult =>
  ({ out, previews: {}, inputs: {}, err: {}, timings: {}, skipped: {}, items: {}, halted: false, aborted: false })

/**
 * Split, run `step.steps` on every item in its own scratch result, put the results
 * back. A failed item (any nested error) follows the step's own error policy: kept
 * as its steps left it (`passthrough`), blanked (`empty`), or failing the whole step
 * (`stop`). Previews come from one sample item — the first that failed, else the
 * first that ran — so nested cards describe one consistent item, and memory does not
 * grow with the number of items.
 */
async function runEach(step: EachStep, input: Value, ctx: Ctx): Promise<Value> {
  const { opts, res, shared } = ctx
  const split = splitItems(input, step.split)
  const n = split.items.length
  const noun = (count: number) => itemNoun(step.split.mode, count)
  const budget = opts.maxEachItems ?? MAX_EACH_ITEMS
  if (shared.items + n > budget) {
    throw new Error(n > budget
      ? `the input has ${n} ${noun(n)}; one run can process at most ${budget}`
      : `too many items in this run: ${shared.items} already processed, and ${n} more would pass the limit of ${budget}`)
  }
  shared.items += n

  const policy = step.onError ?? 'passthrough'
  const skipEmpty = step.skipEmpty !== false
  const itemOpts: RunOptions = { ...opts, load: memoLoad(opts.load), onStep: undefined }
  const timings = new Map<string, number>()
  const results: Value[] = new Array(n)
  let sample: { index: number; run: RunResult } | undefined
  let sampleFinal = false
  let ran = 0
  let failed = 0
  let firstFailure = ''
  let size = 0

  const stopIfAborted = () => {
    if (opts.signal?.aborted) { res.aborted = true; throw new RunAborted() }
  }

  try {
    for (let i = 0; i < n; i++) {
      const item = split.items[i]
      if (skipEmpty && item === '') { results[i] = item; continue }
      stopIfAborted()
      if (defaultClock() - shared.lastYield >= EACH_SLICE_MS) {
        await (opts.yieldToHost ?? macrotask)()
        shared.lastYield = defaultClock()
        stopIfAborted()
      }
      const run = freshResult(item)
      // previews are only worth recording while this item could still become the sample
      const itemCtx: Ctx = { ...ctx, opts: { ...itemOpts, previews: !!opts.previews && !sampleFinal }, res: run }
      const { out } = await runSequence(item, step.steps, itemCtx)
      ran++
      for (const [id, ms] of Object.entries(run.timings)) timings.set(id, (timings.get(id) ?? 0) + ms)
      if (run.aborted) stopIfAborted()

      const error = Object.values(run.err)[0]
      let result = out
      if (error === undefined) {
        sample ??= { index: i, run }
      } else {
        failed++
        const where = `${split.label(i)}: ${error}`
        if (failed === 1) firstFailure = where
        if (!sampleFinal) { sample = { index: i, run }; sampleFinal = true }
        if (policy === 'stop') throw new Error(where)
        if (policy === 'empty') result = ''
      }
      // fail as soon as the parts outgrow the limit (JSON parts are measured once joined, by the caller)
      size += sizeOf(result)
      checkSize(size, ctx)
      results[i] = result
    }
  } finally {
    for (const [id, ms] of timings) res.timings[id] = ms
    const label = sample ? split.label(sample.index) : undefined
    if (sample) {
      const r = sample.run
      Object.assign(res.previews, r.previews)
      Object.assign(res.inputs, r.inputs)
      Object.assign(res.skipped, r.skipped)
      Object.assign((res.items ??= {}), r.items)
      for (const [id, msg] of Object.entries(r.err)) res.err[id] = `${label}: ${msg}`
    }
    ;(res.items ??= {})[step.id] = { total: n, ran, failed, ...(label ? { sample: label } : {}) }
    if (opts.onStep) {
      walkSteps(step.steps, s => {
        const ms = timings.get(s.id)
        if (sample && own(sample.run.err, s.id)) opts.onStep!({ id: s.id, status: 'error', ms })
        else if (sample && own(sample.run.skipped, s.id)) opts.onStep!({ id: s.id, status: 'skipped' })
        else if (ms !== undefined) opts.onStep!({ id: s.id, status: 'done', ms })
      })
    }
  }

  if (failed) {
    res.err[step.id] = `${failed} of ${n} ${noun(n)} failed (${failed > 1 ? 'first: ' : ''}${firstFailure})`
  }
  return split.join(results)
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
      if (e instanceof RunAborted) {
        skipAll(steps.slice(i), 'aborted', ctx)
        return { out, halted: false }
      }
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
    out: source, previews: {}, inputs: {}, err: {}, timings: {}, skipped: {}, items: {}, halted: false, aborted: false,
  }
  const ctx: Ctx = {
    opts, res, clock: opts.clock ?? defaultClock,
    stepCtx: { signal: opts.signal, env: opts.env },
    shared: { items: 0, lastYield: defaultClock() },
  }
  const { out, halted } = await runSequence(source, steps, ctx)
  res.out = out
  res.halted = halted
  return res
}
