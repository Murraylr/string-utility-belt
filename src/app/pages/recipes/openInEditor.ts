import type { PipelineStep } from '@/types/utility'
import { cloneWithNewIds } from '@/core/steps'
import { loadState, saveState } from '@/lib/persist'
import { navigateToPath } from '@/lib/router'
import { handOffInput } from '@/app/ToolContext'
import { autosavePreviousPipeline } from '@/app/library/autosave'

/**
 * Makes `steps` the working pipeline and opens the editor with `input`, without a
 * page load. The pipeline already there is saved to the library first (as when a
 * share link replaces it); if storage refuses that write, the visitor decides
 * whether to replace it anyway. Returns false when they keep their pipeline.
 */
export function openPipelineInEditor({ steps, input, name }: { steps: PipelineStep[]; input: string; name: string }): boolean {
  try {
    autosavePreviousPipeline(loadState().steps, steps)
  } catch {
    const replace = window.confirm(
      'Your current pipeline could not be saved to your library (browser storage is full or disabled). Replace it with this recipe anyway?',
    )
    if (!replace) return false
  }
  saveState({ steps: steps.map(cloneWithNewIds), showPreviews: true, name })
  if (input) handOffInput(input)
  navigateToPath('/')
  return true
}
