/**
 * A "run on each" step's card: how the input is split into items, whether empty items
 * are left alone, the nested steps that run on every item, how many items ran and
 * failed, and the reassembled output. The nested cards' previews describe one sample
 * item, which the card names.
 */
import React from 'react'
import { Repeat } from 'lucide-react'
import type { EachStep, SplitMode, SplitSpec } from '@/types/utility'
import { itemNoun, MAX_SEPARATOR_LENGTH } from '@/core/split'
import { useTool } from '@/app/ToolContext'
import Select from '@/components/Select'
import StepList from '@/app/tool/StepList'
import AdvancedSection, { LINK_BUTTON } from './AdvancedSection'
import LaneGroup from './LaneGroup'
import OutputStrip from './OutputStrip'
import SeparatorField from './SeparatorField'
import StepFrame from './StepFrame'
import StepStateChips from './StepStateChips'
import { CONTAINER_TITLE, useContainerMenu, type ContainerMoves } from './containerMenu'

export interface EachCardProps extends ContainerMoves {
  step: EachStep
  index: number
  /** Steps in the same sequence; bounds the menu's moves. */
  total?: number
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

const ERROR_HINT = 'For each item whose steps fail: continue keeps what its steps produced, empty output blanks ' +
  'the item, and stop fails the whole step (the other items are not kept).'

export default function EachCard({ step, index, total = 1, onDelete, onToggle, onUnwrap, ...moves }: EachCardProps) {
  const { dispatch, run, showPreviews } = useTool()
  const menu = useContainerMenu(step, moves)
  const result = run.result
  const output = result?.previews[step.id]
  const stats = result?.items?.[step.id]
  const mode = step.split.mode
  const noun = itemNoun(mode, 1)
  const nouns = itemNoun(mode, 2)
  const update = (patch: Partial<EachStep>) => dispatch({ type: 'UPDATE_STEP', id: step.id, patch })

  return (
    <StepFrame
      stepId={step.id} index={index} total={total} enabled={step.enabled !== false}
      title={<span className={`${CONTAINER_TITLE} text-[14.5px]`}><Repeat size={14} className="text-acc shrink-0" aria-hidden="true" />{step.label || 'Run on each'}</span>}
      sub={`on each ${noun}`}
      chips={
        <>
          {stats && (
            <span className={`chip tabular-nums ${stats.failed ? 'text-danger border-danger-line' : ''}`} data-testid="each-stats">
              {stats.total} {itemNoun(mode, stats.total)}{stats.failed ? ` · ${stats.failed} failed` : ''}
            </span>
          )}
          <StepStateChips condition={step.condition} onError={step.onError} />
        </>
      }
      // what a failed item became is the error policy's own hint, under Advanced
      ms={result?.timings[step.id]} error={result?.err[step.id]} errorNote={null} skipped={result?.skipped[step.id]}
      onToggle={onToggle} onDelete={onDelete} menu={menu}
      output={showPreviews && output !== undefined && <OutputStrip label="Reassembled output" value={output} input={result?.inputs[step.id]} id="each" />}
    >
      <div className="flex flex-wrap items-end gap-x-3.5 gap-y-2.5 px-3.5 pb-3">
        <label className="grid gap-1 eyebrow min-w-[190px]">Run the steps on each
          <Select aria-label="split the input into" value={mode} options={SPLIT_OPTIONS} className="h-[30px] text-fg"
            onChange={m => update({ split: splitFor(m as SplitMode, step.split) })} />
        </label>
        {step.split.mode === 'delimiter' && (
          <label className="grid gap-1 eyebrow">Separator
            <SeparatorField label="item separator" value={step.split.separator} allowEmpty={false} maxLength={MAX_SEPARATOR_LENGTH}
              onChange={separator => update({ split: { mode: 'delimiter', separator } })} />
          </label>
        )}
        <label className="flex items-center gap-[7px] h-[30px] text-[12.5px] cursor-pointer"
          title={`Leave empty ${nouns} as they are instead of running the steps on them`}>
          <input type="checkbox" checked={step.skipEmpty !== false} onChange={e => update({ skipEmpty: e.target.checked })} />
          Skip empty {nouns}
        </label>
      </div>
      <div className="px-3.5 pb-3">
        <LaneGroup title={`Steps run on each ${noun}`} label={`steps run on each ${noun}`}
          note={showPreviews && stats?.sample && `previews show ${stats.sample}${stats.failed ? ', the first that failed' : ''}`}>
          {step.steps.length === 0 && (
            <div className="px-1 py-1.5 text-xs text-muted">No steps yet. Each {noun} passes straight through.</div>
          )}
          <StepList steps={step.steps} parentId={step.id} scope="run-on-each step" />
        </LaneGroup>
      </div>
      <AdvancedSection condition={step.condition} onError={step.onError} errorHint={ERROR_HINT}
        onUpdate={patch => dispatch({ type: 'UPDATE_STEP', id: step.id, patch })}
        links={<button type="button" className={LINK_BUTTON} onClick={onUnwrap ?? (() => dispatch({ type: 'UNWRAP', id: step.id }))}>Unwrap</button>} />
    </StepFrame>
  )
}
