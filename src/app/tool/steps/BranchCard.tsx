/**
 * A branch step's card (§8.7): lane headers, merge controls, per-lane add/preview.
 * Moved out of StepList so it can grow independently; StepList still owns wiring
 * each lane's nested sequence back to a `<StepList parentId lane>`.
 */
import React from 'react'
import { GitFork, Plus, Trash2 } from 'lucide-react'
import type { BranchStep, MergeSpec } from '@/types/utility'
import { useTool } from '@/app/ToolContext'
import Select from '@/components/Select'
import StepList from '@/app/tool/StepList'
import AdvancedSection from './AdvancedSection'
import PreviewBox from './PreviewBox'
import StepStateChips from './StepStateChips'
import { laneOutput } from './laneOutput'
import SeparatorField from './SeparatorField'
import { stateToneClass } from './status'

export interface BranchCardProps {
  step: BranchStep
  index: number
  onDelete: () => void
  onToggle: (v: boolean) => void
}

const MERGE_MODES = ['concat', 'zip', 'json', 'pick'] as const

export default function BranchCard({ step, index, onDelete, onToggle }: BranchCardProps) {
  const { dispatch, run, showPreviews } = useTool()
  const result = run.result
  const err = result?.err[step.id]
  const merged = result?.previews[step.id]
  const merge = step.merge
  const setMerge = (next: MergeSpec) => dispatch({ type: 'UPDATE_STEP', id: step.id, patch: { merge: next } })
  const laneOptions = step.branches.map((_, i) => ({ label: `lane ${i + 1}`, value: String(i) }))
  if (merge.mode === 'pick' && !(merge.index >= 0 && merge.index < step.branches.length)) {
    // keep a stale pick visible (the run reports it as an error) instead of showing lane 1
    laneOptions.push({ label: `lane ${merge.index + 1} (missing)`, value: String(merge.index) })
  }

  return (
    <div className={`card p-4 grid gap-3 border-primary-500/40 ${step.enabled === false ? 'opacity-60' : ''} ${stateToneClass(result?.skipped[step.id], err)}`}
      data-step-id={step.id}>
      <div className="flex flex-wrap items-center gap-2">
        <label className="p-3.5 -m-3.5 inline-flex cursor-pointer touch-manipulation">
          <input aria-label={`toggle step ${index + 1}`} type="checkbox" checked={step.enabled !== false} onChange={e => onToggle(e.target.checked)} />
        </label>
        <GitFork size={16} className="text-primary-600" aria-hidden="true" />
        <span className="font-medium">branch</span>
        <span className="text-sm muted">step {index + 1}</span>
        <StepStateChips condition={step.condition} onError={step.onError} ms={result?.timings[step.id]} skipped={result?.skipped[step.id]} />
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <label className="muted flex items-center gap-2">merge
            <Select value={merge.mode} options={[...MERGE_MODES]}
              onChange={mode => setMerge(
                mode === 'pick' ? { mode, index: 0 }
                  : mode === 'json' ? { mode }
                    : { mode: mode as 'concat' | 'zip', separator: merge.mode === 'concat' || merge.mode === 'zip' ? merge.separator : '\n' },
              )} />
          </label>
          {(merge.mode === 'concat' || merge.mode === 'zip') && (
            <label className="muted flex items-center gap-2">separator
              <SeparatorField label="merge separator" value={merge.separator ?? '\n'}
                onChange={separator => setMerge({ mode: merge.mode as 'concat' | 'zip', separator })} />
            </label>
          )}
          {merge.mode === 'pick' && (
            <label className="muted flex items-center gap-2">lane
              <Select value={String(merge.index)} options={laneOptions}
                onChange={v => setMerge({ mode: 'pick', index: Number(v) })} />
            </label>
          )}
          <button type="button" className="btn" aria-label={`add a lane to step ${index + 1}`}
            onClick={() => dispatch({ type: 'ADD_LANE', id: step.id })}><Plus size={14} aria-hidden="true" /> lane</button>
          <button type="button" className="icon-btn text-danger" aria-label={`delete step ${index + 1}`} onClick={onDelete}><Trash2 size={16} /></button>
        </div>
      </div>
      <AdvancedSection condition={step.condition} onError={step.onError}
        onUpdate={patch => dispatch({ type: 'UPDATE_STEP', id: step.id, patch })} />
      {err && <div role="alert" className="text-sm text-danger bg-danger/10 border border-danger/30 rounded-xl p-2">{err}</div>}
      <div className="grid gap-3 md:grid-cols-2">
        {step.branches.map((laneSteps, lane) => {
          const lanePreview = showPreviews ? laneOutput(result, step.id, laneSteps) : undefined
          return (
            <div key={lane} className="rounded-2xl border border-dashed p-3 grid gap-2 bg-surface-2/50" role="group" aria-label={`lane ${lane + 1}`}>
              <div className="flex items-center justify-between">
                <span className="text-xs muted">lane {lane + 1}</span>
                {step.branches.length > 1 && (
                  <button type="button" className="icon-btn text-xs" aria-label={`remove lane ${lane + 1}`}
                    onClick={() => dispatch({ type: 'REMOVE_LANE', id: step.id, lane })}>
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
              <StepList steps={laneSteps} parentId={step.id} lane={lane} />
              {lanePreview !== undefined && <PreviewBox label={`lane ${lane + 1} output`} value={lanePreview} id={`lane-${lane + 1}`} />}
            </div>
          )
        })}
      </div>
      {showPreviews && merged !== undefined && <PreviewBox label="merged output" value={merged} id="merged" />}
    </div>
  )
}
