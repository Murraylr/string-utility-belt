/**
 * A macro step's card (§8.8): its name (edited in place), show/hide its steps, unwrap,
 * save to the library.
 */
import React, { useEffect, useId, useRef, useState } from 'react'
import { Package } from 'lucide-react'
import type { MacroStep } from '@/types/utility'
import { useTool } from '@/app/ToolContext'
import { cloneWithNewIds, countSteps } from '@/core/steps'
import { saveEntry } from '@/app/library/storage'
import StepList from '@/app/tool/StepList'
import AdvancedSection, { LINK_BUTTON } from './AdvancedSection'
import LaneGroup from './LaneGroup'
import OutputStrip from './OutputStrip'
import StepFrame from './StepFrame'
import StepStateChips from './StepStateChips'
import { CONTAINER_TITLE, useContainerMenu, type ContainerMoves } from './containerMenu'

export interface MacroCardProps extends ContainerMoves {
  step: MacroStep
  index: number
  /** Steps in the same sequence; bounds the menu's moves. */
  total?: number
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
    <input aria-label="macro name" value={draft} maxLength={120} spellCheck={false}
      className="h-[26px] w-60 max-w-full min-w-0 -ml-1 px-1 rounded-[5px] border border-transparent bg-transparent font-semibold outline-hidden hover:border-line focus:border-acc"
      onChange={e => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={e => {
        if (e.key === 'Enter') { e.preventDefault(); commit() }
        if (e.key === 'Escape') { e.preventDefault(); setDraft(name) }
      }} />
  )
}

export default function MacroCard({ step, index, total = 1, onDelete, onToggle, onUnwrap, ...moves }: MacroCardProps) {
  const { dispatch, run, showPreviews } = useTool()
  // a macro is renamed in its own name field, so the menu has no Rename
  const menu = useContainerMenu(step, moves, { rename: false })
  const [open, setOpen] = useState(false)
  const [savedMsg, setSavedMsg] = useState('')
  const msgTimer = useRef<ReturnType<typeof setTimeout>>()
  const bodyId = useId()
  const result = run.result
  const output = result?.previews[step.id]
  const count = countSteps(step.steps)

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
      announce(`Could not save "${step.name}". Browser storage is full or unavailable.`)
    }
  }

  return (
    <StepFrame
      stepId={step.id} index={index} total={total} enabled={step.enabled !== false}
      title={
        <span className={`${CONTAINER_TITLE} text-[14.5px]`}>
          <Package size={14} className="text-acc shrink-0" aria-hidden="true" />
          <MacroNameField name={step.name} onCommit={name => dispatch({ type: 'UPDATE_STEP', id: step.id, patch: { name } })} />
        </span>
      }
      sub={`${count} ${count === 1 ? 'step' : 'steps'}`}
      chips={<StepStateChips condition={step.condition} onError={step.onError} />}
      ms={result?.timings[step.id]} error={result?.err[step.id]} onError={step.onError} skipped={result?.skipped[step.id]}
      onToggle={onToggle} onDelete={onDelete} menu={menu}
      output={showPreviews && output !== undefined && <OutputStrip label="Output" value={output} input={result?.inputs[step.id]} id="macro" />}
    >
      {open && (
        <div className="px-3.5 pb-3">
          <LaneGroup id={bodyId} title="Steps in this macro">
            <StepList steps={step.steps} parentId={step.id} />
          </LaneGroup>
        </div>
      )}
      <AdvancedSection condition={step.condition} onError={step.onError}
        onUpdate={patch => dispatch({ type: 'UPDATE_STEP', id: step.id, patch })}
        links={
          <>
            <button type="button" className={LINK_BUTTON} aria-expanded={open} aria-controls={open ? bodyId : undefined}
              onClick={() => setOpen(o => !o)}>{open ? 'Hide steps' : 'Show steps'}</button>
            <button type="button" className={LINK_BUTTON} onClick={onUnwrap ?? (() => dispatch({ type: 'UNWRAP', id: step.id }))}>Unwrap</button>
            <button type="button" className={LINK_BUTTON} onClick={saveToLibrary}>Save to library</button>
            {/* always rendered (never display:none) so screen readers track it before the first message */}
            <span role="status" aria-live="polite" className="text-xs text-muted empty:sr-only">{savedMsg}</span>
          </>
        } />
    </StepFrame>
  )
}
