/**
 * When a share link replaces the editor, the pipeline that was there gets one
 * chance to survive: if it is non-trivial and different from what is being opened,
 * it is saved to the library as a timestamped autosave — but never a second time
 * for content that is already saved somewhere in the library.
 */
import type { PipelineStep } from '@/types/utility'
import { sanitizeSteps } from '@/core/serialize'
import { mapChildSequences } from '@/core/steps'
import { listEntries, saveEntry, type LibraryEntry } from './storage'

/** JSON.stringify with keys sorted at every level, so two structurally-equal steps
 *  compare equal even after a round trip through storage reorders their keys
 *  (`sanitizeSteps` rebuilds each step object in its own fixed field order). */
function stableStringify(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(',')}]`
  if (v && typeof v === 'object') {
    const keys = Object.keys(v as Record<string, unknown>).sort()
    return `{${keys.map(k => `${JSON.stringify(k)}:${stableStringify((v as Record<string, unknown>)[k])}`).join(',')}}`
  }
  return JSON.stringify(v)
}

/** Steps as stored (sanitised: explicit `enabled`, JSON-clean params) with every id removed. */
function withoutIds(steps: PipelineStep[]): Record<string, unknown>[] {
  return steps.map(s => {
    const rest: Record<string, unknown> = { ...mapChildSequences(s, seq => withoutIds(seq) as unknown as PipelineStep[]) }
    delete rest.id
    return rest
  })
}

const fingerprint = (steps: PipelineStep[]) => stableStringify(withoutIds(sanitizeSteps(steps)))

/**
 * Do two step trees do the same thing? Compared in their stored form and ignoring
 * ids, so a pipeline that went through storage, a share link or a clone (fresh ids)
 * still matches the original.
 */
export const sameSteps = (a: PipelineStep[], b: PipelineStep[]) => fingerprint(a) === fingerprint(b)

export function autosaveLabel(when: Date = new Date()): string {
  return `Autosave — ${when.toLocaleString()}`
}

/**
 * Save `previousSteps` to the library as an autosave, unless there is nothing to
 * save, it matches the pipeline about to replace it, or an identical pipeline is
 * already in the library. Returns the new entry, or null when nothing was saved.
 * Throws `LibraryWriteError` when storage refuses the write.
 */
export function autosavePreviousPipeline(previousSteps: PipelineStep[], incomingSteps: PipelineStep[]): LibraryEntry | null {
  if (!previousSteps.length) return null
  const prev = fingerprint(previousSteps)
  if (prev === fingerprint(incomingSteps)) return null
  const alreadySaved = listEntries('pipeline').some(e => fingerprint(e.steps) === prev)
  if (alreadySaved) return null
  return saveEntry({ kind: 'pipeline', name: autosaveLabel(), steps: previousSteps })
}
