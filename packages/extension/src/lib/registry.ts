/**
 * The extension's view of the app's utility registry: metadata from the
 * generated manifest, code loaded per utility through the generated loaders
 * (code-split chunks in the popup/options pages; inlined into the service
 * worker, which cannot use dynamic `import()` — see vite.config.ts).
 */
import { formatForDisplay, valueType } from '../../../../src/core/coerce'
import type { UtilityMeta } from '../../../../src/core/registry'
import { runPipeline } from '../../../../src/core/runner'
import type { Params, Utility, Value } from '../../../../src/types/utility'
import { MANIFEST } from '../../../../src/utilities/_generated/manifest'
import { LOADERS } from '../../../../src/utilities/_generated/loaders'
import { UNSAFE_ENV } from './constants'

export function isEdgeSafe(meta: Pick<UtilityMeta, 'env'>): boolean {
  return !meta.env.some(e => UNSAFE_ENV.has(e))
}

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
