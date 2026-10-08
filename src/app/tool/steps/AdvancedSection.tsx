/** Collapsible "Advanced" panel (§8.6 / §8.11): a step's run condition and error policy. */
import React, { useId, useState } from 'react'
import type { Condition, ErrorPolicy } from '@/types/utility'
import ConditionEditor from './ConditionEditor'
import ErrorPolicySelect from './ErrorPolicySelect'

export interface AdvancedSectionProps {
  condition?: Condition
  onError?: ErrorPolicy
  /** Receives `{ condition }` or `{ onError }`; `undefined` values mean "back to the default". */
  onUpdate: (patch: Record<string, unknown>) => void
  /** What the error policy means for this kind of step, when it means more than usual. */
  errorHint?: string
  /** More text buttons for the same row as the toggle (unwrap, show steps). */
  links?: React.ReactNode
}

/** The dotted text buttons in the row under a card's body. */
export const LINK_BUTTON = 'py-0.5 text-xs text-muted underline decoration-dotted underline-offset-[3px] hover:text-fg'

export default function AdvancedSection({ condition, onError, onUpdate, errorHint, links }: AdvancedSectionProps) {
  const [open, setOpen] = useState(false)
  const panelId = useId()
  return (
    <>
      <div className="flex flex-wrap items-center gap-x-3 px-3.5 pb-2.5">
        <button type="button" className={LINK_BUTTON} aria-expanded={open}
          aria-controls={open ? panelId : undefined} onClick={() => setOpen(o => !o)}>
          {open ? 'Hide advanced' : 'Advanced'}
        </button>
        {links}
      </div>
      {open && (
        <div id={panelId} className="mx-3.5 mb-3 px-3 py-2.5 rounded-md bg-surface-2 grid gap-3 grid-cols-[repeat(auto-fit,minmax(min(100%,220px),1fr))]">
          <div className="grid gap-1.5 content-start">
            <span className="eyebrow">Run this step</span>
            <ConditionEditor condition={condition} onChange={c => onUpdate({ condition: c })} />
          </div>
          <div className="grid gap-1.5 content-start">
            <span className="eyebrow">If this step fails</span>
            <ErrorPolicySelect value={onError} onChange={v => onUpdate({ onError: v })} />
            {errorHint && <p className="m-0 text-[11.5px] text-muted text-pretty">{errorHint}</p>}
          </div>
        </div>
      )}
    </>
  )
}
