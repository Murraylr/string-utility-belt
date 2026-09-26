import React, { useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { BookOpen, ChevronDown, ChevronUp, Diff as DiffIcon, Trash2 } from 'lucide-react'
import { formatForDisplay, valueType } from '@/core/coerce'
import type { UtilityStep, Value } from '@/types/utility'
import { registry } from '@/app/registry'
import { utilityPath } from '@/app/pages/related'
import { utilityOptionGroups } from '@/app/utilityOptions'
import { useOptionalTool } from '@/app/ToolContext'
import AdvancedSection from '@/app/tool/steps/AdvancedSection'
import StepMenu from '@/app/tool/steps/StepMenu'
import StepDiff from '@/app/tool/steps/StepDiff'
import StepStateChips from '@/app/tool/steps/StepStateChips'
import { stateToneClass } from '@/app/tool/steps/status'
import CopyAsMenu from './CopyAsMenu'
import ParamsEditor from './ParamsEditor'
import Select from './Select'

export interface StepCardProps {
  index: number
  step: UtilityStep
  total: number
  onMoveUp: () => void
  onMoveDown: () => void
  onDelete: () => void
  onToggle: (enabled: boolean) => void
  onChangeParams: (params: Record<string, unknown>) => void
  onChangeUtil: (utilityId: string) => void
  /** This step's output from the last run (when previews are on). */
  preview?: Value
  /** This step's input from the last run (when previews are on). */
  input?: Value
  error?: string
  /** Milliseconds spent in this step's apply(). */
  ms?: number
  skipped?: string
  /** Extra controls rendered in the header (feature slots). */
  headerExtras?: React.ReactNode
  /** Extra content rendered under the params (feature slots). */
  children?: React.ReactNode
  /**
   * Handlers for the "more" menu and the advanced section. Each falls back to
   * dispatching on `useOptionalTool()` when omitted, so a card rendered inside a
   * `<ToolProvider>` works with no extra wiring; a standalone card (tests, docs)
   * without either just renders the controls inertly.
   */
  onDuplicate?: () => void
  onSolo?: () => void
  onRename?: (label: string) => void
  onUpdateStep?: (patch: Record<string, unknown>) => void
}

export default function StepCard({
  index, step, total, onMoveUp, onMoveDown, onDelete, onToggle, onChangeParams, onChangeUtil,
  preview, input, error, ms, skipped, headerExtras, children,
  onDuplicate, onSolo, onRename, onUpdateStep,
}: StepCardProps) {
  const meta = registry.get(step.utilityId)
  const tool = useOptionalTool()
  const utilityFieldId = useId()
  const options = useMemo(() => {
    const groups = utilityOptionGroups()
    // keep an unknown id selectable so the card still renders it
    return meta ? groups : [{ label: step.utilityId, value: step.utilityId }, ...groups]
  }, [meta, step.utilityId])
  const enabled = step.enabled !== false
  const [showDiff, setShowDiff] = useState(false)
  const upRef = useRef<HTMLButtonElement>(null)
  const downRef = useRef<HTMLButtonElement>(null)
  const movedWith = useRef<'up' | 'down' | null>(null)

  // A header move that lands on an edge disables the button that was just pressed,
  // which drops keyboard focus; hand it to the twin move button instead.
  useLayoutEffect(() => {
    const dir = movedWith.current
    movedWith.current = null
    if (!dir) return
    const pressed = dir === 'down' ? downRef.current : upRef.current
    const active = document.activeElement
    if (active && active !== document.body && active !== pressed) return
    if (pressed?.disabled) (dir === 'down' ? upRef : downRef).current?.focus()
  }, [index, total])

  const updateStep = onUpdateStep
    ?? ((patch: Record<string, unknown>) => tool?.dispatch({ type: 'UPDATE_STEP', id: step.id, patch }))
  const duplicate = onDuplicate ?? (() => tool?.dispatch({ type: 'DUPLICATE_STEP', id: step.id }))
  const solo = onSolo ?? (() => tool?.dispatch({ type: 'SOLO_STEP', id: step.id }))
  const rename = onRename
    ?? ((label: string) => tool?.dispatch({ type: 'UPDATE_STEP', id: step.id, patch: { label: label.trim() || undefined } }))

  return (
    <div className={`card p-4 flex flex-col gap-3 ${enabled ? '' : 'opacity-60'} ${stateToneClass(skipped, error)}`} data-step-id={step.id}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* padding + equal negative margin grows the tap target (WCAG 2.5.8) to
              ~40px without shifting layout: it fills the surrounding gap-2 instead
              of pushing siblings, so it never changes flow. */}
          <label className="p-3.5 -m-3.5 inline-flex cursor-pointer touch-manipulation">
            <input aria-label={`toggle step ${index + 1}`} type="checkbox" checked={enabled} onChange={e => onToggle(e.target.checked)} />
          </label>
          <span className="text-sm text-muted">step {index + 1}</span>
          {step.label && <span className="font-medium">{step.label}</span>}
          <span className="chip">{meta?.category ?? 'unknown'}</span>
          {preview !== undefined && <span className="chip">{valueType(preview)}</span>}
          <StepStateChips condition={step.condition} onError={step.onError} ms={ms} skipped={skipped} />
        </div>
        <div className="flex items-center gap-1">
          {headerExtras}
          <button ref={upRef} type="button" className="icon-btn" aria-label={`move step ${index + 1} up`} disabled={index === 0}
            onClick={() => { movedWith.current = 'up'; onMoveUp() }}><ChevronUp size={16} /></button>
          <button ref={downRef} type="button" className="icon-btn" aria-label={`move step ${index + 1} down`} disabled={index === total - 1}
            onClick={() => { movedWith.current = 'down'; onMoveDown() }}><ChevronDown size={16} /></button>
          <button type="button" className="icon-btn text-danger" aria-label={`delete step ${index + 1}`} onClick={onDelete}><Trash2 size={16} /></button>
          <StepMenu index={index} total={total} label={step.label}
            onDuplicate={duplicate} onSolo={solo} onRename={rename} onMoveUp={onMoveUp} onMoveDown={onMoveDown} onDelete={onDelete} />
        </div>
      </div>
      <div className="grid md:grid-cols-3 gap-4 items-start">
        <div className="md:col-span-1 min-w-0">
          <label className="muted" htmlFor={utilityFieldId}>utility</label>
          <Select id={utilityFieldId} value={step.utilityId} onChange={onChangeUtil} options={options} className="w-full" />
          <div className="text-xs text-muted mt-1">{meta?.description ?? `unknown utility "${step.utilityId}"`}</div>
          {meta && (
            <a className="text-xs text-primary-600 hover:underline inline-flex items-center gap-1 mt-1" href={utilityPath(meta.id)}>
              <BookOpen size={12} aria-hidden /> {meta.name} docs
            </a>
          )}
        </div>
        <div className="md:col-span-2 min-w-0">
          {meta && <ParamsEditor spec={meta.params} params={step.params ?? {}} onChange={onChangeParams} />}
        </div>
      </div>

      <AdvancedSection condition={step.condition} onError={step.onError} onUpdate={updateStep} />

      {children}
      {error && <div role="alert" className="text-sm text-danger bg-danger/10 border border-danger/30 rounded-xl p-2">{String(error)}</div>}
      {preview !== undefined && (
        <div className="bg-surface-2 rounded-xl p-3 text-sm">
          <div className="flex items-center justify-between mb-1 gap-2">
            <span className="text-muted">preview</span>
            <div className="flex items-center gap-1">
              <button type="button" className={`icon-btn ${showDiff ? 'text-primary-600' : ''}`} aria-pressed={showDiff}
                aria-label="toggle diff view" title="diff vs. this step's input" onClick={() => setShowDiff(d => !d)}>
                <DiffIcon size={16} />
              </button>
              <CopyAsMenu value={preview} />
            </div>
          </div>
          {showDiff
            ? <StepDiff before={input ?? ''} after={preview} />
            : <pre className="font-mono [overflow-wrap:anywhere] whitespace-pre-wrap overflow-auto max-h-80">{formatForDisplay(preview)}</pre>}
        </div>
      )}
    </div>
  )
}
