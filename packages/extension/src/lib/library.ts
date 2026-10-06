/**
 * Favourites and saved pipelines: the list operations the options page and the
 * service worker share, and the service worker's handling of the web app's
 * requests (`AppRequest`), which arrive from a page and are validated in full.
 */
import {
  MAX_FAVORITES, MAX_PIPELINE_CHARS, MAX_SAVED_PIPELINES, extensionUnsupportedSteps, normalizePipelineName,
  type AppRequest, type BridgeResult,
} from '../../../../src/core/extensionBridge'
import { sanitizeSteps } from '../../../../src/core/serialize'
import type { PipelineStep } from '../../../../src/types/utility'
import { getEdgeSafeUtilityMeta, getUtilityMeta } from './registry'
import {
  getMenuUtilities, getPipelines, newPipelineId, setMenuUtilities, setPipelines, type SavedPipeline,
} from './storage'

export type Outcome<T> = { ok: true; value: T } | { ok: false; error: string }

/** Why `steps` can't be saved to the extension, or null when they can. */
export function pipelineProblem(steps: PipelineStep[]): string | null {
  if (!steps.length) return 'The pipeline has no steps.'
  const unsupported = extensionUnsupportedSteps(steps, getUtilityMeta)
  if (unsupported.length) {
    const names = [...new Set(unsupported.map(u => getUtilityMeta(u.utilityId)?.name ?? u.utilityId))]
    return `The extension can't run ${names.join(', ')}. Remove ${names.length === 1 ? 'that step' : 'those steps'} and try again.`
  }
  if (JSON.stringify(steps).length > MAX_PIPELINE_CHARS) return 'The pipeline is too large to save in the extension.'
  return null
}

/**
 * Saves `steps` under `name`. A pipeline with the same name (ignoring case) is
 * replaced in place, keeping its id and menu position, so re-saving after an
 * edit in the app updates it rather than adding a duplicate.
 */
export function upsertPipeline(
  list: SavedPipeline[], rawName: string, rawSteps: unknown, now: number, makeId: () => string = newPipelineId,
): Outcome<{ list: SavedPipeline[]; saved: SavedPipeline; replaced: boolean }> {
  const name = normalizePipelineName(rawName)
  if (!name) return { ok: false, error: 'Give the pipeline a name.' }
  const steps = sanitizeSteps(rawSteps)
  const problem = pipelineProblem(steps)
  if (problem) return { ok: false, error: problem }
  const key = name.toLocaleLowerCase()
  const index = list.findIndex(p => p.name.toLocaleLowerCase() === key)
  if (index >= 0) {
    const saved = { ...list[index], name, steps, updatedAt: now }
    return { ok: true, value: { list: list.map((p, i) => (i === index ? saved : p)), saved, replaced: true } }
  }
  if (list.length >= MAX_SAVED_PIPELINES) {
    return { ok: false, error: `The extension holds up to ${MAX_SAVED_PIPELINES} pipelines. Delete one in its options first.` }
  }
  const saved = { id: makeId(), name, steps, updatedAt: now }
  return { ok: true, value: { list: [...list, saved], saved, replaced: false } }
}

/** Appends the runnable, not-yet-favourite ids of `ids` to `current`, up to `MAX_FAVORITES`. */
export function mergeFavorites(current: string[], ids: string[]): { list: string[]; added: number; unavailable: number; overflow: number } {
  const list = [...current]
  let added = 0
  let unavailable = 0
  let overflow = 0
  for (const id of new Set(ids)) {
    if (!getEdgeSafeUtilityMeta(id)) unavailable++
    else if (list.includes(id)) continue
    else if (list.length >= MAX_FAVORITES) overflow++
    else {
      list.push(id)
      added++
    }
  }
  return { list, added, unavailable, overflow }
}

/** Moves the item at `index` by `delta` places; the same array when it can't move. */
export function move<T>(list: readonly T[], index: number, delta: -1 | 1): T[] {
  const to = index + delta
  if (index < 0 || index >= list.length || to < 0 || to >= list.length) return [...list]
  const out = [...list]
  ;[out[index], out[to]] = [out[to], out[index]]
  return out
}

// Read-modify-write of the lists runs one at a time, so two requests arriving
// together can't each read the old list and drop the other's change.
let queue: Promise<unknown> = Promise.resolve()
function serialized<T>(fn: () => Promise<T>): Promise<T> {
  const next = queue.then(fn, fn)
  queue = next.catch(() => undefined)
  return next
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/** The service worker's answer to a request from the web app. Never rejects. */
export function handleAppRequest(request: AppRequest, now: () => number = Date.now): Promise<BridgeResult> {
  return serialized(async (): Promise<BridgeResult> => {
    if (request.type === 'save-pipeline') {
      const outcome = upsertPipeline(await getPipelines(), request.name, request.steps, now())
      if (!outcome.ok) return { ok: false, error: outcome.error }
      await setPipelines(outcome.value.list)
      const { saved, replaced } = outcome.value
      return { ok: true, message: `${replaced ? 'Updated' : 'Saved'} "${saved.name}" — it's on the right-click menu.` }
    }
    const { list, added, unavailable, overflow } = mergeFavorites(await getMenuUtilities(), request.utilityIds)
    if (added) await setMenuUtilities(list)
    const parts = [added ? `Added ${plural(added, 'favourite', 'favourites')} to the right-click menu.` : 'No new favourites to add.']
    if (unavailable) parts.push(`${plural(unavailable, "utility isn't", "utilities aren't")} available in the extension.`)
    if (overflow) parts.push(`${plural(overflow, 'was', 'were')} left out: the extension holds up to ${MAX_FAVORITES} favourites.`)
    return { ok: true, message: parts.join(' ') }
  }).catch((e: unknown) => ({ ok: false, error: `The extension could not save: ${(e as Error)?.message || String(e)}` }))
}
