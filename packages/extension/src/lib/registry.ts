/**
 * The extension's view of the app's utility registry: metadata from the
 * generated manifest, code loaded per utility through the generated loaders
 * (code-split chunks in the popup/options pages; inlined into the service
 * worker, which cannot use dynamic `import()` — see vite.config.ts).
 */
import { formatForDisplay, valueType } from '../../../../src/core/coerce'
import { canRunInExtension, extensionUnsupportedSteps } from '../../../../src/core/extensionBridge'
import type { UtilityMeta } from '../../../../src/core/registry'
import { runPipeline } from '../../../../src/core/runner'
import { itemNoun } from '../../../../src/core/split'
import { isEachStep, walkSteps } from '../../../../src/core/steps'
import type { Params, PipelineStep, Utility, Value } from '../../../../src/types/utility'
import { MANIFEST } from '../../../../src/utilities/_generated/manifest'
import { LOADERS } from '../../../../src/utilities/_generated/loaders'

/** The shared rule (`canRunInExtension`): no dom, main or eval capability. */
export const isEdgeSafe = (meta: Pick<UtilityMeta, 'env'>): boolean => canRunInExtension(meta)

const byId = new Map(MANIFEST.map(m => [m.id, m]))

/** Every utility the extension may run or offer, sorted by category then name. */
export function edgeSafeUtilities(): UtilityMeta[] {
  return MANIFEST.filter(isEdgeSafe).slice().sort((a, b) =>
    a.category === b.category ? a.name.localeCompare(b.name) : a.category.localeCompare(b.category))
}

/** Raw lookup, including utilities the extension refuses to run. */
export function getUtilityMeta(id: string): UtilityMeta | undefined {
  return byId.get(id)
}

/** Like `getUtilityMeta`, but `undefined` for anything not edge-safe — the single
 * gate that keeps dom/main/eval utilities out of the menu and the popup. */
export function getEdgeSafeUtilityMeta(id: string): UtilityMeta | undefined {
  const meta = byId.get(id)
  return meta && isEdgeSafe(meta) ? meta : undefined
}

async function loadUtility(id: string): Promise<Utility> {
  const load = LOADERS[id]
  if (!load) throw new Error(`unknown utility: ${id}`)
  return (await load()).default
}

/** Runs one utility with declared defaults filled in for any param not given. */
export async function runUtilityById(id: string, input: Value, params: Params = {}): Promise<Value> {
  const meta = getEdgeSafeUtilityMeta(id)
  if (!meta) {
    const raw = getUtilityMeta(id)
    throw new Error(raw ? `${id} cannot run in the extension (needs ${raw.env.join(', ')})` : `unknown utility: ${id}`)
  }
  const result = await runPipeline(input, [{ id: 'step', utilityId: id, params }], { load: loadUtility })
  const err = result.err.step
  if (err) throw new Error(err)
  return result.out
}

/** A step's display name for error messages: its label, else its utility's name, else its kind. */
function stepName(step: PipelineStep): string {
  if (step.label) return step.label
  if (step.type === 'branch') return 'branch'
  if (step.type === 'macro') return step.name
  if (step.type === 'each') return `run on each ${itemNoun(step.split.mode, 1)}`
  return byId.get(step.utilityId)?.name ?? step.utilityId
}

/**
 * Runs a saved pipeline. A run whose result the user did not ask for fails as a
 * whole, so the page is never written with half-transformed text: any error in
 * a step that kept the default error policy, and any halt (`onError: 'stop'`).
 * A step with an explicit `passthrough` or `empty` policy failing is the
 * pipeline working as its author designed, and its result is kept — and so is
 * a failure inside a "run on each" step with such a policy, which decides what
 * a failed item becomes.
 */
export async function runPipelineSteps(steps: PipelineStep[], input: Value): Promise<Value> {
  const unsupported = extensionUnsupportedSteps(steps, getUtilityMeta)
  if (unsupported.length) {
    const { utilityId, reason } = unsupported[0]
    throw new Error(`${byId.get(utilityId)?.name ?? utilityId} cannot run in the extension (${reason})`)
  }
  const result = await runPipeline(input, steps, { load: loadUtility })
  let failure: string | undefined
  const designed = (s: PipelineStep) => s.onError !== undefined && s.onError !== 'stop'
  walkSteps(steps, (step, parents) => {
    const err = result.err[step.id]
    if (err === undefined || designed(step) || parents.some(p => isEachStep(p) && designed(p))) return
    failure = `${stepName(step)}: ${err}`
    return false
  })
  if (failure) throw new Error(failure)
  return result.out
}

/**
 * A utility's output as text to put in a page or a textarea: JSON pretty-printed,
 * bytes decoded when they are valid UTF-8 and shown as the app shows them
 * (decimal + hex listing) when they are not — never `JSON.stringify`'s
 * `{"0":…}` rendering of a Uint8Array.
 */
export function resultToText(value: Value): string {
  if (valueType(value) === 'bytes') {
    try {
      return new TextDecoder('utf-8', { fatal: true }).decode(value as Uint8Array)
    } catch {
      return formatForDisplay(value)
    }
  }
  return formatForDisplay(value)
}
