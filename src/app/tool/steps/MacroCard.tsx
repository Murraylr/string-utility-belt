/**
 * A macro step's card (§8.8): rename, expand/collapse, unwrap, save to library.
 * Moved out of StepList so it can grow independently.
 */
import React, { useEffect, useId, useRef, useState } from 'react'
import { Layers, Trash2 } from 'lucide-react'
import type { MacroStep } from '@/types/utility'
import { useTool } from '@/app/ToolContext'
import { cloneWithNewIds } from '@/core/steps'
import { saveEntry } from '@/app/library/storage'
import StepList from '@/app/tool/StepList'
import AdvancedSection from './AdvancedSection'
import PreviewBox from './PreviewBox'
import StepStateChips from './StepStateChips'
import { stateToneClass } from './status'

export interface MacroCardProps {
  step: MacroStep
  index: number
  onDelete: () => void
  onToggle: (v: boolean) => void
  /** Replaces the default UNWRAP dispatch (StepList uses it to keep keyboard focus in place). */
  onUnwrap?: () => void
}

/**
 * The name field edits a local draft and commits once (Enter or blur) so a rename is
 * one undo entry, not one per keystroke. Escape reverts; a blank name is rejected.
 */
function MacroNameField({ name, onCommit }: { name: string; onCommit: (name: string) => void }) {
  const [draft, setDraft] = useState(name)
  const [synced, setSynced] = useState(name)
  if (name !== synced) { setSynced(name); setDraft(name) }
  const commit = () => {
    const next = draft.trim()
    if (next && next !== name) onCommit(next)
    else setDraft(name)
  }
  return (
    // 120: the longest macro name a share link / import keeps (core/serialize)
    <input className="field font-medium" aria-label="macro name" value={draft} maxLength={120}
      onChange={e => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={e => {
        if (e.key === 'Enter') { e.preventDefault(); commit() }
        if (e.key === 'Escape') { e.preventDefault(); setDraft(name) }
      }} />
  )
}

export default function MacroCard({ step, index, onDelete, onToggle, onUnwrap }: MacroCardProps) {
  const { dispatch, run, showPreviews } = useTool()
  const [open, setOpen] = useState(false)
  const [savedMsg, setSavedMsg] = useState('')
  const msgTimer = useRef<ReturnType<typeof setTimeout>>()
  const bodyId = useId()
  const result = run.result
  const err = result?.err[step.id]
  const output = result?.previews[step.id]

  useEffect(() => () => clearTimeout(msgTimer.current), [])

  const announce = (msg: string) => {
    setSavedMsg(msg)
    clearTimeout(msgTimer.current)
    msgTimer.current = setTimeout(() => setSavedMsg(''), 4000)
  }

  const saveToLibrary = () => {
    try {
      saveEntry({ kind: 'macro', name: step.name, steps: step.steps.map(cloneWithNewIds) })
      announce(`saved "${step.name}" to library`)
    } catch {
      announce(`could not save "${step.name}" — browser storage is full or unavailable`)
    }
  }

  return (
    <div className={`card p-4 grid gap-3 ${step.enabled === false ? 'opacity-60' : ''} ${stateToneClass(result?.skipped[step.id], err)}`} data-step-id={step.id}>
      <div className="flex flex-wrap items-center gap-2">
        <label className="p-3.5 -m-3.5 inline-flex cursor-pointer touch-manipulation">
          <input aria-label={`toggle step ${index + 1}`} type="checkbox" checked={step.enabled !== false} onChange={e => onToggle(e.target.checked)} />
        </label>
        <Layers size={16} className="text-primary-600" aria-hidden="true" />
        <MacroNameField name={step.name} onCommit={name => dispatch({ type: 'UPDATE_STEP', id: step.id, patch: { name } })} />
        <span className="text-sm muted">step {index + 1}</span>
        <StepStateChips condition={step.condition} onError={step.onError} ms={result?.timings[step.id]} skipped={result?.skipped[step.id]} />
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {/* always rendered (never display:none) so screen readers track it before the first message */}
          <span role="status" aria-live="polite" className="text-xs muted">{savedMsg}</span>
          <span className="chip">{step.steps.length} {step.steps.length === 1 ? 'step' : 'steps'}</span>
          <button type="button" className="btn" onClick={saveToLibrary}>Save to library</button>
          <button type="button" className="btn" aria-expanded={open} aria-controls={open ? bodyId : undefined}
            onClick={() => setOpen(o => !o)}>{open ? 'collapse' : 'expand'}</button>
          <button type="button" className="btn" onClick={onUnwrap ?? (() => dispatch({ type: 'UNWRAP', id: step.id }))}>unwrap</button>
          <button type="button" className="icon-btn text-danger" aria-label={`delete step ${index + 1}`} onClick={onDelete}><Trash2 size={16} /></button>
        </div>
      </div>
      <AdvancedSection condition={step.condition} onError={step.onError}
        onUpdate={patch => dispatch({ type: 'UPDATE_STEP', id: step.id, patch })} />
      {err && <div role="alert" className="text-sm text-danger bg-danger/10 border border-danger/30 rounded-xl p-2">{err}</div>}
      {open && <div id={bodyId}><StepList steps={step.steps} parentId={step.id} /></div>}
      {showPreviews && output !== undefined && <PreviewBox label="macro output" value={output} id="macro" />}
    </div>
  )
}
