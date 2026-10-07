import type { PipelineStep } from '@/types/utility'
import { migratePipeline, schemaVersionFor } from '@/core/serialize'

const CURRENT_KEY = 'string-utility-belt'

export interface PersistedState {
  steps: PipelineStep[]
  showPreviews: boolean
  /** Name of the pipeline being edited (library entry), if any. */
  name?: string
  libraryId?: string
}

/** Stored with the oldest schema that can read it, like every pipeline document (see `schemaVersionFor`). */
export function saveState(state: Partial<PersistedState>) {
  const steps = state?.steps ?? []
  const safe = {
    v: schemaVersionFor(steps),
    steps,
    showPreviews: !!state?.showPreviews,
    ...(state?.name ? { name: state.name } : {}),
    ...(state?.libraryId ? { libraryId: state.libraryId } : {}),
  }
  try { localStorage.setItem(CURRENT_KEY, JSON.stringify(safe)) } catch { /* quota or disabled storage */ }
}

/**
 * Load the working pipeline. Accepts every stored shape (v1 `{steps, showPreviews}`,
 * v2 and v3), and drops entries that would crash the render — anything else, e.g. an
 * unknown utilityId, degrades gracefully to a step error.
 */
export function loadState(): PersistedState {
  let raw: string | null = null
  try { raw = localStorage.getItem(CURRENT_KEY) } catch { /* storage disabled */ }
  if (!raw) return { steps: [], showPreviews: true }
  try {
    const parsed = JSON.parse(raw)
    const doc = migratePipeline(parsed)
    return {
      steps: doc.steps,
      showPreviews: parsed && typeof parsed === 'object' && 'showPreviews' in parsed ? !!parsed.showPreviews : true,
      ...(typeof parsed?.name === 'string' ? { name: parsed.name } : {}),
      ...(typeof parsed?.libraryId === 'string' ? { libraryId: parsed.libraryId } : {}),
    }
  } catch {
    return { steps: [], showPreviews: true }
  }
}
