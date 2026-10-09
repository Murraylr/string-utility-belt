import type { PipelineStep } from '@/types/utility'
import { cloneWithNewIds } from '@/core/steps'
import { loadState, saveState } from '@/lib/persist'
import { navigateToPath } from '@/lib/router'
import { handOffInput } from '@/app/ToolContext'
import { autosavePreviousPipeline } from '@/app/library/autosave'

/**
 * What became of "Open in the editor": `opened` in place; `kept` when the visitor
 * chose to keep their own pipeline; `failed` when storage refused the preset, so
 * the editor would open without it (the caller follows the share link instead).
 */
export type OpenOutcome = 'opened' | 'kept' | 'failed'

/**
 * Makes `steps` the working pipeline and opens the editor with `input`, without a
 * page load. The pipeline already there is saved to the library first (as when a
 * share link replaces it); if storage refuses that write, the visitor decides
 * whether to replace it anyway.
 */
export function openPipelineInEditor({ steps, input, name }: { steps: PipelineStep[]; input: string; name: string }): OpenOutcome {
  try {
    autosavePreviousPipeline(loadState().steps, steps)
  } catch {
    const replace = window.confirm(
      'Your current pipeline could not be saved to your library (browser storage is full or disabled). Replace it with this preset anyway?',
    )
    if (!replace) return 'kept'
  }
  if (!saveState({ steps: steps.map(cloneWithNewIds), showPreviews: true, name })) return 'failed'
  if (input) handOffInput(input)
  navigateToPath('/')
  return 'opened'
}

/** A full navigation to `href` (the share-link fallback when storage is unavailable). */
export function followLink(href: string): void {
  location.assign(href)
}
