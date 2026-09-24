import React, { useMemo } from 'react'
import { GitFork, Plus, Redo2, Undo2 } from 'lucide-react'
import Select from '@/components/Select'
import { defaultParams } from '@/core/params'
import { registry } from '@/app/registry'
import { utilityOptionGroups } from '@/app/utilityOptions'
import { useTool } from '@/app/ToolContext'

export interface PipelineToolbarProps {
  onTogglePicker: () => void
  /** Whether the utility picker is showing; exposed as the toggle's `aria-expanded`. */
  pickerOpen?: boolean
  /** Feature slots rendered after the built-in controls. */
  children?: React.ReactNode
}

export default function PipelineToolbar({ onTogglePicker, pickerOpen, children }: PipelineToolbarProps) {
  const { dispatch, showPreviews, setShowPreviews, canUndo, canRedo } = useTool()
  const options = useMemo(() => [{ label: '— select —', value: '' }, ...utilityOptionGroups()], [])

  return (
    <section className="flex flex-wrap items-center gap-3" aria-label="pipeline toolbar">
      <button type="button" className="cta" aria-expanded={pickerOpen} onClick={onTogglePicker}>
        <span className="inline-flex items-center gap-2"><Plus size={16} /> Add utility</span>
      </button>
      <span className="muted" aria-hidden="true">or quick add</span>
      <Select value="" aria-label="quick add a utility" onChange={id => id && dispatch({ type: 'ADD_STEP', utilityId: id, params: defaultParams(registry.get(id)) })}
        options={options as any} className="max-w-sm" />
      <button type="button" className="btn" onClick={() => dispatch({ type: 'ADD_BRANCH' })} title="fork the pipeline into parallel lanes">
        <GitFork size={16} /> branch
      </button>
      <div className="flex items-center gap-1">
        <button type="button" className="icon-btn" aria-label="undo" title="undo (Ctrl+Z)" disabled={!canUndo} onClick={() => dispatch({ type: 'UNDO' })}><Undo2 size={16} /></button>
        <button type="button" className="icon-btn" aria-label="redo" title="redo (Ctrl+Shift+Z)" disabled={!canRedo} onClick={() => dispatch({ type: 'REDO' })}><Redo2 size={16} /></button>
      </div>
      {children}
      <label className="ml-auto text-sm flex items-center gap-2">
        <input type="checkbox" checked={showPreviews} onChange={e => setShowPreviews(e.target.checked)} />
        show intermediate previews
      </label>
    </section>
  )
}
