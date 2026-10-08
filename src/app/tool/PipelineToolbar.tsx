import React from 'react'
import { Redo2, Undo2 } from 'lucide-react'
import { countSteps, walkSteps } from '@/core/steps'
import { useTool } from '@/app/ToolContext'
import { useSelection } from './steps/selection'
import { SelectToggle } from './steps/SelectionBar'

export interface PipelineToolbarProps {
  /** Feature slots after the undo/redo group (magic, turn all on/off). */
  children?: React.ReactNode
  /** Controls after the previews toggle (the engine's 64 KB limit, live/manual, Run). */
  trailing?: React.ReactNode
}

const ICON = 'size-7 grid place-items-center rounded-[5px] text-muted hover:bg-surface-2 hover:text-fg disabled:opacity-40 disabled:hover:bg-transparent'

/**
 * The row above the step list: the step count, selection mode for the top-level
 * pipeline, undo/redo, feature slots, and the previews toggle. Reads the selection
 * provider `StepsSection` mounts around it and the list.
 */
export default function PipelineToolbar({ children, trailing }: PipelineToolbarProps) {
  const { state, dispatch, showPreviews, setShowPreviews, canUndo, canRedo } = useTool()
  const sel = useSelection()
  const total = countSteps(state.steps)
  let on = 0
  walkSteps(state.steps, s => { if (s.enabled !== false) on++ })

  return (
    <div className="flex flex-wrap items-center gap-1 pb-3.5" role="group" aria-label="steps toolbar">
      <h2 className="m-0 text-[13px] font-semibold">Steps</h2>
      {total > 0 && <span className="font-mono text-[11px] text-muted px-1.5">{total} · {on} on</span>}
      <div className="flex-1" />
      {(total > 0 || sel?.active) && <SelectToggle />}
      <button type="button" className={ICON} aria-label="Undo" title="Undo (Ctrl+Z)" disabled={!canUndo} onClick={() => dispatch({ type: 'UNDO' })}>
        <Undo2 size={15} aria-hidden="true" />
      </button>
      <button type="button" className={ICON} aria-label="Redo" title="Redo (Ctrl+Shift+Z)" disabled={!canRedo} onClick={() => dispatch({ type: 'REDO' })}>
        <Redo2 size={15} aria-hidden="true" />
      </button>
      <span aria-hidden="true" className="w-px h-4 mx-1 bg-line" />
      {children}
      <label className="btn-ghost cursor-pointer">
        <input type="checkbox" checked={showPreviews} onChange={e => setShowPreviews(e.target.checked)} />
        Previews
      </label>
      {trailing}
    </div>
  )
}
