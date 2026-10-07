/**
 * Renders a sequence of steps (the top level, a branch lane, or a macro or "run on
 * each" body) and wires each card to the store. Recursive: branch lanes and macro and
 * each bodies are StepLists of their own, addressed by `parentId` / `lane`.
 *
 * Owns drag-and-drop reordering (framer-motion `Reorder`) and selection mode
 * (`SelectionProvider`, scoped to this one sequence) for its direct children.
 */
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Reorder, useDragControls, useReducedMotion } from 'framer-motion'
import { GripVertical } from 'lucide-react'
import type { PipelineStep } from '@/types/utility'
import { isBranchStep, isEachStep, isMacroStep, isUtilityStep } from '@/core/steps'
import { defaultParams } from '@/core/params'
import StepCard from '@/components/StepCard'
import Select from '@/components/Select'
import { registry } from '@/app/registry'
import { utilityOptionGroups } from '@/app/utilityOptions'
import { useTool } from '@/app/ToolContext'
import { trackUtilityAdd } from '@/app/analytics/analytics'
import BranchCard from './steps/BranchCard'
import EachCard from './steps/EachCard'
import MacroCard from './steps/MacroCard'
import { SelectionProvider } from './steps/SelectionContext'
import { useSelection } from './steps/selection'
import SelectionBar from './steps/SelectionBar'
import CustomCodeNotice from '@/app/sandbox/CustomCodeNotice'

export interface StepListProps {
  steps: PipelineStep[]
  parentId?: string
  lane?: number
  /** Names a nested sequence in accessible labels ("lane 2", "macro"); defaults from `lane`. */
  scope?: string
}

export default function StepList(props: StepListProps) {
  return (
    <SelectionProvider>
      <StepListInner {...props} />
    </SelectionProvider>
  )
}

function StepListInner({ steps, parentId, lane, scope }: StepListProps) {
  const scopeLabel = parentId ? (lane !== undefined ? `lane ${lane + 1}` : scope ?? 'macro') : undefined
  const { dispatch } = useTool()
  const ids = useMemo(() => steps.map(s => s.id), [steps])
  const idsKey = ids.join('\u0000')
  const [order, setOrder] = useState(ids)
  const [syncedKey, setSyncedKey] = useState(idsKey)
  const [moveMsg, setMoveMsg] = useState('')
  const msgTimer = useRef<ReturnType<typeof setTimeout>>()
  const handles = useRef(new Map<string, HTMLButtonElement>())
  const focusAfterRemove = useRef<number | null>(null)

  // Resync the visual order whenever the sequence's actual id set/order changes
  // from outside a drag (add/remove/undo, or our own committed REORDER). Adjusted
  // during render (not an effect) so it lands in the same commit as the new props.
  if (idsKey !== syncedKey) {
    setSyncedKey(idsKey)
    setOrder(ids)
  }

  // Removing a card that held focus would drop focus to <body>: move it to the drag
  // handle of the card that took its place (or the new last card).
  useLayoutEffect(() => {
    const at = focusAfterRemove.current
    if (at === null) return
    focusAfterRemove.current = null
    const active = document.activeElement
    if (active && active !== document.body && active.isConnected) return
    const id = ids[Math.min(at, ids.length - 1)]
    if (id) handles.current.get(id)?.focus()
  }, [ids])

  useEffect(() => () => clearTimeout(msgTimer.current), [])

  const announceMove = useCallback((position: number, total: number) => {
    setMoveMsg(`moved step to position ${position} of ${total}`)
    clearTimeout(msgTimer.current)
    msgTimer.current = setTimeout(() => setMoveMsg(''), 3000)
  }, [])

  const registerHandle = useCallback((id: string, el: HTMLButtonElement | null) => {
    if (el) handles.current.set(id, el); else handles.current.delete(id)
  }, [])

  const byId = useMemo(() => new Map(steps.map(s => [s.id, s])), [steps])

  const commitOrder = (current: string[]) => {
    if (current.length === ids.length && current.every((id, i) => id === ids[i])) return
    dispatch({ type: 'REORDER', ids: current, parentId, lane })
  }

  const rendered = order.map(id => byId.get(id)).filter((s): s is PipelineStep => !!s)

  return (
    <div className="grid gap-3">
      <SelectionBar order={ids} parentId={parentId} lane={lane} scopeLabel={scopeLabel} />
      <Reorder.Group as="div" axis="y" values={order} onReorder={setOrder} className="grid gap-3">
        {rendered.map((step, i) => (
          <ReorderableStep key={step.id} step={step} index={i} total={rendered.length}
            onCommit={() => commitOrder(order)} onMoved={announceMove} registerHandle={registerHandle}
            onRemoving={() => { focusAfterRemove.current = i }} />
        ))}
      </Reorder.Group>
      {parentId && <AddInto parentId={parentId} lane={lane} label={lane !== undefined ? `lane ${lane + 1}` : `this ${scopeLabel}`} />}
      <span role="status" aria-live="polite" className="sr-only">{moveMsg}</span>
    </div>
  )
}

function DragHandle({ index, total, controls, onMoveUp, onMoveDown, handleRef }: {
  index: number
  total: number
  controls: ReturnType<typeof useDragControls>
  onMoveUp: () => void
  onMoveDown: () => void
  handleRef: (el: HTMLButtonElement | null) => void
}) {
  // focus survives the move: React restores it to this (keyed, re-inserted) button after the commit
  const onKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (!e.altKey) return
    if (e.key === 'ArrowUp' && index > 0) {
      e.preventDefault()
      onMoveUp()
    } else if (e.key === 'ArrowDown' && index < total - 1) {
      e.preventDefault()
      onMoveDown()
    }
  }
  return (
    <button ref={handleRef} type="button" className="icon-btn cursor-grab touch-none mt-4 shrink-0"
      aria-label={`reorder step ${index + 1} (drag, or focus and press Alt+Arrow keys to move)`}
      aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown"
      onPointerDown={e => controls.start(e)} onKeyDown={onKeyDown}>
      <GripVertical size={16} />
    </button>
  )
}

/** One reorderable row: the drag handle, an optional selection checkbox, and the step's own card. */
function ReorderableStep({ step, index, total, onCommit, onMoved, registerHandle, onRemoving }: {
  step: PipelineStep
  index: number
  total: number
  onCommit: () => void
  /** Announces the new 1-based position after a move. */
  onMoved: (position: number, total: number) => void
  registerHandle: (id: string, el: HTMLButtonElement | null) => void
  /** Called just before this step is removed, so the list can place focus afterwards. */
  onRemoving: () => void
}) {
  const { dispatch, run } = useTool()
  const controls = useDragControls()
  const reducedMotion = useReducedMotion()
  const sel = useSelection()

  const common = {
    onMoveUp: () => {
      if (index === 0) return
      dispatch({ type: 'MOVE_STEP', id: step.id, direction: 'up' as const })
      onMoved(index, total)
    },
    onMoveDown: () => {
      if (index >= total - 1) return
      dispatch({ type: 'MOVE_STEP', id: step.id, direction: 'down' as const })
      onMoved(index + 2, total)
    },
    onDelete: () => {
      onRemoving()
      dispatch({ type: 'REMOVE_STEP', id: step.id })
    },
    onToggle: (enabled: boolean) => dispatch({ type: 'TOGGLE_STEP', id: step.id, enabled }),
  }

  let card: React.ReactNode = null
  if (isUtilityStep(step)) {
    const r = run.result
    card = (
      <StepCard
        index={index} step={step} total={total} {...common}
        onChangeParams={params => dispatch({ type: 'SET_PARAMS', id: step.id, params })}
        onChangeUtil={utilityId => dispatch({ type: 'CHANGE_UTILITY', id: step.id, utilityId, params: defaultParams(registry.get(utilityId)) })}
        preview={r?.previews[step.id]}
        input={r?.inputs[step.id]}
        error={r?.err[step.id]}
        ms={r?.timings[step.id]}
        skipped={r?.skipped[step.id]}
      >
        {/* renders only for code-running utilities (custom JS): review before enabling */}
        <CustomCodeNotice utilityId={step.utilityId} enabled={step.enabled !== false} />
      </StepCard>
    )
  } else if (isBranchStep(step)) {
    card = <BranchCard step={step} index={index} onDelete={common.onDelete} onToggle={common.onToggle} />
  } else if (isMacroStep(step)) {
    card = (
      <MacroCard step={step} index={index} onDelete={common.onDelete} onToggle={common.onToggle}
        onUnwrap={() => { onRemoving(); dispatch({ type: 'UNWRAP', id: step.id }) }} />
    )
  } else if (isEachStep(step)) {
    card = (
      <EachCard step={step} index={index} onDelete={common.onDelete} onToggle={common.onToggle}
        onUnwrap={() => { onRemoving(); dispatch({ type: 'UNWRAP', id: step.id }) }} />
    )
  }

  return (
    // layout="position": animate moves only — a size animation would scale-distort the
    // card's text every time its preview grows or shrinks
    <Reorder.Item as="div" value={step.id} dragListener={false} dragControls={controls} layout="position"
      transition={reducedMotion ? { duration: 0 } : undefined}
      onDragEnd={onCommit} className="flex items-start gap-2" data-step-row={step.id}>
      <DragHandle index={index} total={total} controls={controls} onMoveUp={common.onMoveUp} onMoveDown={common.onMoveDown}
        handleRef={el => registerHandle(step.id, el)} />
      {sel?.active && (
        // padding + matched negative margins grow the tap target (WCAG 2.5.8) to ~40px
        // while reproducing the bare checkbox's original mt-4-aligned flow footprint.
        <label className="mt-0.5 -mx-3.5 -mb-3.5 p-3.5 shrink-0 inline-flex cursor-pointer touch-manipulation">
          <input type="checkbox" aria-label={`select step ${index + 1}`}
            checked={sel.isSelected(step.id)} onChange={() => sel.toggle(step.id)} />
        </label>
      )}
      <div className="flex-1 min-w-0">{card}</div>
    </Reorder.Item>
  )
}

function AddInto({ parentId, lane, label }: { parentId: string; lane?: number; label: string }) {
  const { dispatch } = useTool()
  const options = React.useMemo(() => [{ label: '+ add step…', value: '' }, ...utilityOptionGroups()], [])
  return (
    <Select className="text-sm w-full" value="" options={options as any}
      aria-label={`add a step to ${label}`}
      onChange={id => {
        if (!id) return
        dispatch({ type: 'ADD_STEP', utilityId: id, params: defaultParams(registry.get(id)), target: { parentId, lane } })
        trackUtilityAdd(id, 'nested')
      }} />
  )
}
