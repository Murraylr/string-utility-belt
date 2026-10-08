/**
 * The "Select" toggle and bulk-action bar for one sequence (§8.13). Reads/writes
 * the nearest `<SelectionProvider>` (see SelectionContext.tsx). The top-level
 * pipeline's toggle sits in the steps toolbar (`SelectToggle`); a nested sequence
 * shows its own above its steps. Macro names are asked for inline (not
 * `window.prompt`, which blocks the page and is suppressed in sandboxed frames),
 * and outcomes are announced through a polite live region.
 */
import React, { useEffect, useRef, useState } from 'react'
import { useTool } from '@/app/ToolContext'
import { cloneWithNewIds, findStep } from '@/core/steps'
import { saveEntry } from '@/app/library/storage'
import type { PipelineStep } from '@/types/utility'
import { useSelection } from './selection'

export interface SelectionBarProps {
  /** This sequence's step ids, in display order. */
  order: string[]
  parentId?: string
  lane?: number
  /** Names a nested sequence ("lane 2", "macro"); a nested sequence shows its own toggle. */
  scopeLabel?: string
}

type Naming = 'group' | 'save' | null

const ACTION = 'btn h-[26px] px-[9px] text-[12.5px] font-normal'

/** Turns selection mode on and off for the nearest sequence. */
export function SelectToggle({ scopeLabel }: { scopeLabel?: string }) {
  const sel = useSelection()
  if (!sel) return null
  const { active, setActive, setToggleButton } = sel
  const text = active ? 'Done selecting' : 'Select'
  return (
    <button ref={setToggleButton} type="button" aria-pressed={active}
      className="btn-ghost aria-pressed:bg-surface-2 aria-pressed:text-fg"
      aria-label={scopeLabel ? `${text.toLowerCase()} steps in ${scopeLabel}` : undefined}
      onClick={() => setActive(!active)}>
      {text}
    </button>
  )
}

export default function SelectionBar({ order, scopeLabel }: SelectionBarProps) {
  const sel = useSelection()
  const { dispatch, state } = useTool()
  const [naming, setNaming] = useState<Naming>(null)
  const [name, setName] = useState('macro')
  const [status, setStatus] = useState('')
  const groupRef = useRef<HTMLButtonElement>(null)
  const saveRef = useRef<HTMLButtonElement>(null)
  const statusTimer = useRef<ReturnType<typeof setTimeout>>()
  useEffect(() => () => clearTimeout(statusTimer.current), [])

  if (!sel || (order.length === 0 && !sel.active)) return null

  const orderedSelected = order.filter(id => sel.isSelected(id))
  const hasSelection = orderedSelected.length > 0
  const isContiguous = sel.contiguous(order)

  const announce = (msg: string) => {
    setStatus(msg)
    clearTimeout(statusTimer.current)
    statusTimer.current = setTimeout(() => setStatus(''), 4000)
  }

  const startNaming = (mode: Exclude<Naming, null>) => { setName('macro'); setNaming(mode) }
  const stopNaming = (focus: HTMLButtonElement | null) => { setNaming(null); focus?.focus() }

  const submitName = () => {
    const trimmed = name.trim()
    if (!trimmed || !hasSelection) return
    if (naming === 'group') {
      if (!isContiguous) return
      dispatch({ type: 'WRAP', ids: orderedSelected, as: 'macro', name: trimmed })
      sel.clear()
      announce(`grouped ${orderedSelected.length} steps into "${trimmed}"`)
      stopNaming(sel.toggleButton)
    } else {
      const steps = orderedSelected
        .map(id => findStep(state.steps, id))
        .filter((s): s is PipelineStep => !!s)
        .map(cloneWithNewIds)
      try {
        saveEntry({ kind: 'macro', name: trimmed, steps })
        announce(`saved "${trimmed}" to library`)
      } catch {
        announce(`Could not save "${trimmed}". Browser storage is full or unavailable.`)
      }
      stopNaming(saveRef.current)
    }
  }

  const runOnEach = () => {
    dispatch({ type: 'WRAP', ids: orderedSelected, as: 'each' })
    sel.clear()
    announce(`${orderedSelected.length === 1 ? 'the step now runs' : `${orderedSelected.length} steps now run`} on each line`)
    sel.toggleButton?.focus()
  }
  const putInBranch = () => {
    dispatch({ type: 'WRAP', ids: orderedSelected, as: 'branch' })
    sel.clear()
    announce(`put ${orderedSelected.length} ${orderedSelected.length === 1 ? 'step' : 'steps'} in a branch`)
    // the pressed button is disabled once the selection clears: keep keyboard focus in the bar
    sel.toggleButton?.focus()
  }
  const deleteSelected = () => {
    // one REMOVE_STEP per id: there is no batched removal action, so undo is per step
    for (const id of orderedSelected) dispatch({ type: 'REMOVE_STEP', id })
    sel.clear()
    announce(`deleted ${orderedSelected.length} ${orderedSelected.length === 1 ? 'step' : 'steps'}`)
    sel.toggleButton?.focus()
  }

  // leaving selection mode drops a half-typed name: the form belongs to the bar
  if (!sel.active && naming) setNaming(null)
  const nameTarget = () => (naming === 'group' ? groupRef.current : saveRef.current)
  const n = orderedSelected.length

  return (
    <>
      {scopeLabel && (
        <div className="flex items-center">
          <SelectToggle scopeLabel={scopeLabel} />
        </div>
      )}
      {sel.active && (
        <div role="group" aria-label="selection actions"
          className="flex flex-wrap items-center gap-1.5 px-2.5 py-2 border rounded-lg bg-surface-2">
          <span className="text-[12.5px] font-medium pr-1">{n} selected</span>
          <button ref={groupRef} type="button" className={ACTION} disabled={!hasSelection || !isContiguous}
            aria-expanded={naming === 'group'} onClick={() => startNaming('group')}>
            Group into macro
          </button>
          <button type="button" className={ACTION} disabled={!hasSelection || !isContiguous} onClick={putInBranch}>
            Put in a branch
          </button>
          <button type="button" className={ACTION} disabled={!hasSelection || !isContiguous} onClick={runOnEach}
            title="Run the selected steps on every line on its own. You can switch to list items or JSON values afterwards.">
            Run on each line
          </button>
          <button ref={saveRef} type="button" className={ACTION} disabled={!hasSelection}
            aria-expanded={naming === 'save'} onClick={() => startNaming('save')}>
            Save as macro
          </button>
          <button type="button" className={`${ACTION} text-danger hover:text-danger`} disabled={!hasSelection} onClick={deleteSelected}>
            Delete
          </button>
          {hasSelection && !isContiguous && (
            <span className="text-xs text-warn">Pick steps next to each other to group or wrap them.</span>
          )}
          {naming && (
            <form className="flex flex-wrap gap-1.5 basis-full" onSubmit={e => { e.preventDefault(); submitName() }}>
              <input autoFocus className="field h-7 flex-1 min-w-0 max-w-[280px]" aria-label="name for the new macro" value={name} maxLength={120}
                onChange={e => setName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Escape') { e.preventDefault(); stopNaming(nameTarget()) }
                }} />
              <button type="submit" className="btn-inv h-7 px-2.5 text-[12.5px]" disabled={!name.trim()}>{naming === 'group' ? 'Group' : 'Save'}</button>
              <button type="button" className="btn-ghost h-7 px-2.5" onClick={() => stopNaming(nameTarget())}>
                Cancel
              </button>
            </form>
          )}
        </div>
      )}
      {/* always rendered (never display:none) so screen readers track it before the first message */}
      <span role="status" aria-live="polite" className="text-xs text-muted empty:sr-only">{status}</span>
    </>
  )
}
