/**
 * The work behind `run_utility`, `run_pipeline` and `detect_format`, as plain
 * structured-cloneable jobs. `runJob` holds every check and runs the utility code,
 * so the whole thing — untrusted share decoding included — can execute inside a
 * child process that is killed on timeout (see executor.ts), or in-process for tests.
 *
 * A refusal or failure throws; the thrown message is what the agent sees.
 */
import {
  childSequences, coerceInputFor, countSteps, decodeShare, isUtilityStep, resolveAccepts, resolveParams,
  runPipeline, sanitizeSteps, unsupportedSteps, utilityIds, validateParams, walkSteps,
} from '../../../src/core'
import type { PipelineStep, UtilityMeta, Value } from '../../../src/core'
import { staticRegistry } from '../../../src/utilities/static-registry'
import { decodeInput, errorMessage, plainParams, renderOutput, shareToPayload } from './format'
import type { InputEncoding } from './format'
import { MAX_PIPELINE_STEPS, MAX_SHARE_CHARS } from './limits'

export type Job =
  | { kind: 'utility'; id: string; input: string; inputEncoding?: InputEncoding; params?: Record<string, unknown> }
  | { kind: 'pipeline'; steps?: unknown[]; share?: string; input: string; inputEncoding?: InputEncoding }
  | { kind: 'detect'; input: string; inputEncoding?: InputEncoding }

/** A tool's JSON body — the value `runJob` resolves with. */
export type JobResult = Record<string, unknown>

const lookup = (id: string) => staticRegistry.get(id)

/** Utilities whose `apply` runs arbitrary user JavaScript. Refused everywhere in this server. */
export const isEvalUtility = (meta: UtilityMeta | undefined): boolean => !!meta?.env.includes('eval')

const CODE_REFUSAL = 'LLM-driven code execution is out of scope for this server.'

/** Makes a missing-DOM failure self-explanatory (Node has no DOMParser/document). */
export function explainError(meta: UtilityMeta | undefined, message: string): string {
  if (meta?.env.includes('dom') && /\b(DOMParser|document|window)\b.* not defined/.test(message)) {
    return `${message} — "${meta.id}" needs a browser DOM, which this Node server does not have`
  }
  return message
}

/** Timings rounded to µs so the agent is not fed 17-digit floats. */
const roundTimings = (t: Record<string, number>) =>
  Object.fromEntries(Object.entries(t).map(([k, v]) => [k, Math.round(v * 1000) / 1000]))

async function applyUtility(meta: UtilityMeta, input: Value, params: Record<string, unknown>, signal: AbortSignal) {
  const util = await staticRegistry.load(meta.id)
  const coerced = coerceInputFor(input, resolveAccepts(util.accepts, input))
  try {
    return await util.apply(coerced, resolveParams(util, params), { signal, env: 'node' })
  } catch (e) {
    throw new Error(explainError(meta, errorMessage(e)))
  }
}

async function runUtilityJob(job: Extract<Job, { kind: 'utility' }>, signal: AbortSignal): Promise<JobResult> {
  const meta = lookup(job.id)
  if (!meta) throw new Error(`unknown utility: ${job.id}`)
  if (isEvalUtility(meta)) throw new Error(`"${job.id}" runs user-supplied JavaScript; ${CODE_REFUSAL}`)
  const params = plainParams(job.params)
  const paramErrors = validateParams(meta, params)
  if (Object.keys(paramErrors).length) throw new Error(`invalid params: ${JSON.stringify(paramErrors)}`)
  const out = await applyUtility(meta, decodeInput(job.input, job.inputEncoding), params, signal)
  return { ...renderOutput(out) }
}

/** Param problems of every step that will actually run (disabled subtrees are skipped). */
function stepParamErrors(steps: PipelineStep[]): Record<string, Record<string, string>> {
  const out: Record<string, Record<string, string>> = {}
  const visit = (seq: PipelineStep[]) => {
    for (const s of seq) {
      if (s.enabled === false) continue
      if (isUtilityStep(s)) {
        const errors = validateParams(lookup(s.utilityId), s.params ?? {})
        if (Object.keys(errors).length) out[s.id] = errors
      } else {
        childSequences(s).forEach(visit)
      }
    }
  }
  visit(steps)
  return out
}

function resolveSteps(job: Extract<Job, { kind: 'pipeline' }>): PipelineStep[] {
  const hasSteps = Array.isArray(job.steps) && job.steps.length > 0
  const share = job.share?.trim()
  // An agent filling every optional field sends `steps: []` next to a real `share`:
  // treat an empty list as absent rather than silently running the identity pipeline.
  if (hasSteps && share) throw new Error('pass either `steps` or `share`, not both')
  if (share) {
    if (share.length > MAX_SHARE_CHARS) {
      throw new Error(`share exceeds the ${MAX_SHARE_CHARS.toLocaleString('en-US')} character limit`)
    }
    return sanitizeSteps(decodeShare(shareToPayload(share)).steps)
  }
  if (job.steps === undefined) throw new Error('pass `steps` (use [] for an empty pipeline) or a `share` link')
  return sanitizeSteps(job.steps)
}

async function runPipelineJob(job: Extract<Job, { kind: 'pipeline' }>, signal: AbortSignal): Promise<JobResult> {
  const steps = resolveSteps(job)
  if (countSteps(steps) > MAX_PIPELINE_STEPS) throw new Error(`pipeline has more than ${MAX_PIPELINE_STEPS} steps`)

  // Checked ahead of the general capability check so the refusal reason is unambiguous:
  // code execution is a policy decision, not an environment gap.
  const evalIds = utilityIds(steps).filter(id => isEvalUtility(lookup(id)))
  if (evalIds.length) throw new Error(`refused: this pipeline runs user-supplied JavaScript (${evalIds.join(', ')}); ${CODE_REFUSAL}`)
  const unsupported = unsupportedSteps(steps, lookup, 'node')
  if (unsupported.length) throw new Error(`step(s) this server cannot run: ${JSON.stringify(unsupported)}`)
  const paramErrors = stepParamErrors(steps)
  if (Object.keys(paramErrors).length) throw new Error(`invalid params (by step id): ${JSON.stringify(paramErrors)}`)

  const decoded = decodeInput(job.input, job.inputEncoding)
  const result = await runPipeline(decoded, steps, { load: uid => staticRegistry.load(uid), signal, env: 'node' })
  if (result.aborted) throw new Error('pipeline was aborted before it finished')

  const utilityOf = new Map<string, string>()
  walkSteps(steps, s => { if (isUtilityStep(s)) utilityOf.set(s.id, s.utilityId) })
  const errors = Object.fromEntries(Object.entries(result.err).map(([id, msg]) => {
    const uid = utilityOf.get(id)
    return [id, explainError(uid ? lookup(uid) : undefined, msg)]
  }))
  return {
    ...renderOutput(result.out),
    errors,
    timings: roundTimings(result.timings),
    skipped: result.skipped,
    halted: result.halted,
  }
}

async function runDetectJob(job: Extract<Job, { kind: 'detect' }>, signal: AbortSignal): Promise<JobResult> {
  const meta = lookup('detect_format')
  if (!meta) throw new Error('unknown utility: detect_format')
  const out = await applyUtility(meta, decodeInput(job.input, job.inputEncoding), {}, signal)
  // the utility renders its ranking as JSON text; hand the agent the array itself
  const candidates = typeof out === 'string' ? JSON.parse(out) : out
  return { candidates }
}

/** Runs one job to completion. Honours `signal` cooperatively (checked between pipeline steps). */
export function runJob(job: Job, signal: AbortSignal): Promise<JobResult> {
  switch (job.kind) {
    case 'utility': return runUtilityJob(job, signal)
    case 'pipeline': return runPipelineJob(job, signal)
    case 'detect': return runDetectJob(job, signal)
    default: return Promise.reject(new Error(`unknown job kind: ${(job as { kind?: unknown }).kind}`))
  }
}
