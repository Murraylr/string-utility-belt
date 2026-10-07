/**
 * A "run on each" step's card: how the input is split into items, whether empty items
 * are left alone, the nested steps that run on every item, how many items ran and
 * failed, and the reassembled output. The nested cards' previews describe one sample
 * item, which the card names.
 */
import React from 'react'
import { Repeat, Trash2 } from 'lucide-react'
import type { EachStep, SplitMode, SplitSpec } from '@/types/utility'
import { itemNoun, MAX_SEPARATOR_LENGTH } from '@/core/split'
import { useTool } from '@/app/ToolContext'
import Select from '@/components/Select'
import StepList from '@/app/tool/StepList'
import AdvancedSection from './AdvancedSection'
import PreviewBox from './PreviewBox'
import SeparatorField from './SeparatorField'
import StepStateChips from './StepStateChips'
import { stateToneClass } from './status'

export interface EachCardProps {
  step: EachStep
  index: number
  onDelete: () => void
  onToggle: (v: boolean) => void
  /** Replaces the default UNWRAP dispatch (StepList uses it to keep keyboard focus in place). */
  onUnwrap?: () => void
}

const SPLIT_OPTIONS: Array<{ value: SplitMode; label: string }> = [
  { value: 'lines', label: 'line' },
  { value: 'delimiter', label: 'piece between separators' },
  { value: 'json-array', label: 'JSON array element' },
  { value: 'json-values', label: 'JSON object value' },
]

/** A new split for `mode`, keeping the current separator when staying on delimiters. */
const splitFor = (mode: SplitMode, current: SplitSpec): SplitSpec =>
  mode === 'delimiter' ? { mode, separator: current.mode === 'delimiter' ? current.separator : ',' } : { mode } as SplitSpec

const ERROR_HINT = 'For each item whose steps fail: passthrough keeps what its steps produced, empty output blanks ' +
  'the item, and stop fails the whole step (the other items are not kept).'

export default function EachCard({ step, index, onDelete, onToggle, onUnwrap }: EachCardProps) {
  const { dispatch, run, showPreviews } = useTool()
  const result = run.result
  const err = result?.err[step.id]
  const output = result?.previews[step.id]
  const stats = result?.items?.[step.id]
  const mode = step.split.mode
  const noun = itemNoun(mode, 1)
  const nouns = itemNoun(mode, 2)
  const update = (patch: Partial<EachStep>) => dispatch({ type: 'UPDATE_STEP', id: step.id, patch })

  return (
    <div className={`card p-4 grid gap-3 border-primary-500/40 ${step.enabled === false ? 'opacity-60' : ''} ${stateToneClass(result?.skipped[step.id], err)}`}
      data-step-id={step.id}>
      <div className="flex flex-wrap items-center gap-2">
        <label className="p-3.5 -m-3.5 inline-flex cursor-pointer touch-manipulation">
          <input aria-label={`toggle step ${index + 1}`} type="checkbox" checked={step.enabled !== false} onChange={e => onToggle(e.target.checked)} />
        </label>
        <Repeat size={16} className="text-primary-600" aria-hidden="true" />
        <label className="font-medium flex items-center gap-2">run on each
          <Select aria-label="split the input into" value={mode} options={SPLIT_OPTIONS}
            onChange={m => update({ split: splitFor(m as SplitMode, step.split) })} />
        </label>
        {step.split.mode === 'delimiter' && (
          <label className="muted flex items-center gap-2">separator
            <SeparatorField label="item separator" value={step.split.separator} allowEmpty={false} maxLength={MAX_SEPARATOR_LENGTH}
              onChange={separator => update({ split: { mode: 'delimiter', separator } })} />
          </label>
        )}
        <span className="text-sm muted">step {index + 1}</span>
        <StepStateChips condition={step.condition} onError={step.onError} ms={result?.timings[step.id]} skipped={result?.skipped[step.id]} />
        {stats && (
          <span className={`chip tabular-nums ${stats.failed ? 'text-danger border-danger/40' : ''}`} data-testid="each-stats">
            {stats.total} {itemNoun(mode, stats.total)}{stats.failed ? ` · ${stats.failed} failed` : ''}
          </span>
        )}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <label className="text-sm flex items-center gap-2" title={`leave empty ${nouns} as they are instead of running the steps on them`}>
            <input type="checkbox" checked={step.skipEmpty !== false} onChange={e => update({ skipEmpty: e.target.checked })} />
            skip empty {nouns}
          </label>
          <button type="button" className="btn" onClick={onUnwrap ?? (() => dispatch({ type: 'UNWRAP', id: step.id }))}>unwrap</button>
          <button type="button" className="icon-btn text-danger" aria-label={`delete step ${index + 1}`} onClick={onDelete}><Trash2 size={16} /></button>
        </div>
      </div>
      <AdvancedSection condition={step.condition} onError={step.onError} errorHint={ERROR_HINT}
        onUpdate={patch => dispatch({ type: 'UPDATE_STEP', id: step.id, patch })} />
      {err && <div role="alert" className="text-sm text-danger bg-danger/10 border border-danger/30 rounded-xl p-2">{err}</div>}
      <div className="rounded-2xl border border-dashed p-3 grid gap-2 bg-surface-2/50" role="group" aria-label={`steps run on each ${noun}`}>
        <div className="text-xs muted">
          steps run on each {noun}
          {showPreviews && stats?.sample && ` — their previews show ${stats.sample}${stats.failed ? ', the first that failed' : ''}`}
        </div>
        <StepList steps={step.steps} parentId={step.id} scope="run-on-each step" />
      </div>
      {showPreviews && output !== undefined && <PreviewBox label="reassembled output" value={output} id="each" />}
    </div>
  )
}
