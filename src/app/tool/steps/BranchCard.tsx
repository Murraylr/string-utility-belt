/**
 * A branch step's card (§8.7): merge controls, then one dashed group per lane holding
 * the lane's own `<StepList parentId lane>`, its add control and its output preview.
 */
import React from 'react'
import { GitFork, Plus, Trash2 } from 'lucide-react'
import type { BranchStep, MergeSpec } from '@/types/utility'
import { useTool } from '@/app/ToolContext'
import Select from '@/components/Select'
import StepList from '@/app/tool/StepList'
import AdvancedSection from './AdvancedSection'
import LaneGroup from './LaneGroup'
import OutputStrip from './OutputStrip'
import PreviewBox from './PreviewBox'
import StepFrame from './StepFrame'
import StepStateChips from './StepStateChips'
import { CONTAINER_TITLE, useContainerMenu, type ContainerMoves } from './containerMenu'
import { laneOutput } from './laneOutput'
import SeparatorField from './SeparatorField'

export interface BranchCardProps extends ContainerMoves {
  step: BranchStep
  index: number
  /** Steps in the same sequence; bounds the menu's moves. */
  total?: number
  onDelete: () => void
  onToggle: (v: boolean) => void
}

const MERGE_MODES = [
  { value: 'concat', label: 'Join with a separator' },
  { value: 'zip', label: 'Zip line by line' },
  { value: 'json', label: 'JSON array' },
  { value: 'pick', label: 'Pick one lane' },
]

const FIELD_LABEL = 'grid gap-1 eyebrow'

export default function BranchCard({ step, index, total = 1, onDelete, onToggle, ...moves }: BranchCardProps) {
  const { dispatch, run, showPreviews } = useTool()
  const menu = useContainerMenu(step, moves)
  const result = run.result
  const merged = result?.previews[step.id]
  const merge = step.merge
  const setMerge = (next: MergeSpec) => dispatch({ type: 'UPDATE_STEP', id: step.id, patch: { merge: next } })
  const laneOptions = step.branches.map((_, i) => ({ label: `Lane ${i + 1}`, value: String(i) }))
  if (merge.mode === 'pick' && !(merge.index >= 0 && merge.index < step.branches.length)) {
    // keep a stale pick visible (the run reports it as an error) instead of showing lane 1
    laneOptions.push({ label: `Lane ${merge.index + 1} (missing)`, value: String(merge.index) })
  }
  const lanes = step.branches.length

  return (
    <StepFrame
      stepId={step.id} index={index} total={total} enabled={step.enabled !== false}
      title={<span className={`${CONTAINER_TITLE} text-[14.5px]`}><GitFork size={14} className="text-acc shrink-0" aria-hidden="true" />{step.label || 'Branch'}</span>}
      sub="parallel lanes"
      chips={<><span className="chip">{lanes} {lanes === 1 ? 'lane' : 'lanes'}</span><StepStateChips condition={step.condition} onError={step.onError} /></>}
      ms={result?.timings[step.id]} error={result?.err[step.id]} onError={step.onError} skipped={result?.skipped[step.id]}
      onToggle={onToggle} onDelete={onDelete} menu={menu}
      output={showPreviews && merged !== undefined && <OutputStrip label="Merged output" value={merged} input={result?.inputs[step.id]} id="merged" />}
    >
      <div className="flex flex-wrap items-end gap-x-3.5 gap-y-2.5 px-3.5 pb-3">
        <label className={`${FIELD_LABEL} min-w-[150px]`}>Merge lanes
          <Select value={merge.mode} options={MERGE_MODES} className="h-[30px] text-fg"
            onChange={mode => setMerge(
              mode === 'pick' ? { mode, index: 0 }
                : mode === 'json' ? { mode }
                  : { mode: mode as 'concat' | 'zip', separator: merge.mode === 'concat' || merge.mode === 'zip' ? merge.separator : '\n' },
            )} />
        </label>
        {(merge.mode === 'concat' || merge.mode === 'zip') && (
          <label className={FIELD_LABEL}>Separator
            <SeparatorField label="merge separator" value={merge.separator ?? '\n'}
              onChange={separator => setMerge({ mode: merge.mode as 'concat' | 'zip', separator })} />
          </label>
        )}
        {merge.mode === 'pick' && (
          <label className={`${FIELD_LABEL} w-[110px]`}>Lane
            <Select value={String(merge.index)} options={laneOptions} className="h-[30px] text-fg"
              onChange={v => setMerge({ mode: 'pick', index: Number(v) })} />
          </label>
        )}
        <button type="button" className="btn h-[30px] px-2.5 text-[12.5px]" aria-label={`add a lane to step ${index + 1}`}
          onClick={() => dispatch({ type: 'ADD_LANE', id: step.id })}><Plus size={13} aria-hidden="true" /> Lane</button>
      </div>
      <div className="grid gap-2.5 px-3.5 pb-3 grid-cols-[repeat(auto-fit,minmax(min(100%,240px),1fr))]">
        {step.branches.map((laneSteps, lane) => {
          const lanePreview = showPreviews ? laneOutput(result, step.id, laneSteps) : undefined
          return (
            <LaneGroup key={lane} title={`Lane ${lane + 1}`} label={`lane ${lane + 1}`}
              actions={lanes > 1 && (
                <button type="button" aria-label={`remove lane ${lane + 1}`} title="Remove lane"
                  className="size-[22px] grid place-items-center rounded-[4px] text-muted hover:text-danger"
                  onClick={() => dispatch({ type: 'REMOVE_LANE', id: step.id, lane })}>
                  <Trash2 size={13} aria-hidden="true" />
                </button>
              )}>
              {laneSteps.length === 0 && (
                <div className="px-1 py-1.5 text-xs text-muted">No steps yet. The input passes straight through.</div>
              )}
              <StepList steps={laneSteps} parentId={step.id} lane={lane} />
              {lanePreview !== undefined && <PreviewBox label={`Lane ${lane + 1} output`} value={lanePreview} id={`lane-${lane + 1}`} />}
            </LaneGroup>
          )
        })}
      </div>
      <AdvancedSection condition={step.condition} onError={step.onError}
        onUpdate={patch => dispatch({ type: 'UPDATE_STEP', id: step.id, patch })} />
    </StepFrame>
  )
}
