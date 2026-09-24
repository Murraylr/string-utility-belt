import type { PipelineStep, Value } from '@/types/utility'
import type { RunResult } from '@/core/runner'

/**
 * A branch lane's output as recorded by a previews run — the value its last step
 * left behind (following error policies), or the branch's own input for an empty
 * lane. `undefined` when the run did not record enough to know (previews off, aborted).
 */
export function laneOutput(result: RunResult | null | undefined, branchId: string, lane: PipelineStep[]): Value | undefined {
  if (!result) return undefined
  let out: Value | undefined = result.inputs[branchId]
  for (const s of lane) {
    if (s.id in result.previews) { out = result.previews[s.id]; continue }
    if (s.id in result.err) {
      out = s.onError === 'empty' ? '' : s.id in result.inputs ? result.inputs[s.id] : out
      if (s.onError === 'stop') return out
      continue
    }
    return undefined // not run (aborted): the lane's output is unknown
  }
  return out
}
