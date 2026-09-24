/**
 * The "Select" toggle and bulk-action bar for one sequence (§8.13). Reads/writes
 * the nearest `<SelectionProvider>` (see SelectionContext.tsx). Macro names are
 * asked for inline (not `window.prompt`, which blocks the page and is suppressed
 * in sandboxed frames), and outcomes are announced through a polite live region.
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
  /** Names a nested sequence ("lane 2", "macro") in the toggle's accessible name. */
  scopeLabel?: string
}

type Naming = 'group' | 'save' | null

export default function SelectionBar({ order, scopeLabel }: SelectionBarProps) {
  const sel = useSelection()
  const { dispatch, state } = useTool()
  const [naming, setNaming] = useState<Naming>(null)
  const [name, setName] = useState('macro')
  const [status, setStatus] = useState('')
  const toggleRef = useRef<HTMLButtonElement>(null)
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
      stopNaming(toggleRef.current)
    } else {
      const steps = orderedSelected
        .map(id => findStep(state.steps, id))
        .filter((s): s is PipelineStep => !!s)
        .map(cloneWithNewIds)
      try {
        saveEntry({ kind: 'macro', name: trimmed, steps })
        announce(`saved "${trimmed}" to library`)
      } catch {
        announce(`could not save "${trimmed}" — browser storage is full or unavailable`)
      }
      stopNaming(saveRef.current)
    }
  }

  const putInBranch = () => {
    dispatch({ type: 'WRAP', ids: orderedSelected, as: 'branch' })
    sel.clear()
    announce(`put ${orderedSelected.length} ${orderedSelected.length === 1 ? 'step' : 'steps'} in a branch`)
    // the pressed button is disabled once the selection clears: keep keyboard focus in the bar
    toggleRef.current?.focus()
  }
  const deleteSelected = () => {
    // one REMOVE_STEP per id: there is no batched removal action, so undo is per step
    for (const id of orderedSelected) dispatch({ type: 'REMOVE_STEP', id })
    sel.clear()
    announce(`deleted ${orderedSelected.length} ${orderedSelected.length === 1 ? 'step' : 'steps'}`)
    toggleRef.current?.focus()
  }

  const toggleText = sel.active ? 'done selecting' : 'select'

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button ref={toggleRef} type="button" className="btn" aria-pressed={sel.active}
        aria-label={scopeLabel ? `${toggleText} steps in ${scopeLabel}` : undefined}
        onClick={() => { setNaming(null); sel.setActive(!sel.active) }}>
        {toggleText}
      </button>
      {sel.active && (
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="selection actions">
          <span className="text-sm muted">{orderedSelected.length} selected</span>
          {hasSelection && !isContiguous && (
            <span className="text-xs text-warn">selection must be contiguous (no gaps) to group</span>
          )}
          <button ref={groupRef} type="button" className="btn" disabled={!hasSelection || !isContiguous}
            aria-expanded={naming === 'group'} onClick={() => startNaming('group')}>
            Group into macro…
          </button>
          <button type="button" className="btn" disabled={!hasSelection || !isContiguous} onClick={putInBranch}>
            Put in a branch
          </button>
          <button ref={saveRef} type="button" className="btn" disabled={!hasSelection}
            aria-expanded={naming === 'save'} onClick={() => startNaming('save')}>
            Save as macro…
          </button>
          <button type="button" className="btn text-danger" disabled={!hasSelection} onClick={deleteSelected}>
            Delete selected
          </button>
        </div>
      )}
      {sel.active && naming && (
        <form className="flex flex-wrap items-center gap-2" onSubmit={e => { e.preventDefault(); submitName() }}>
          <input autoFocus className="field" aria-label="name for the new macro" value={name} maxLength={120}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Escape') { e.preventDefault(); stopNaming(naming === 'group' ? groupRef.current : saveRef.current) }
            }} />
          <button type="submit" className="btn" disabled={!name.trim()}>{naming === 'group' ? 'Group' : 'Save'}</button>
          <button type="button" className="btn"
            onClick={() => stopNaming(naming === 'group' ? groupRef.current : saveRef.current)}>
            Cancel
          </button>
        </form>
      )}
      {/* always rendered (never display:none) so screen readers track it before the first message */}
      <span role="status" aria-live="polite" className="text-xs muted">{status}</span>
    </div>
  )
}
