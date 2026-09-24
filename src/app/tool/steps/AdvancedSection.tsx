/** Collapsible "advanced" panel (§8.6 / §8.11): a step's run condition and error policy. */
import React, { useId, useState } from 'react'
import type { Condition, ErrorPolicy } from '@/types/utility'
import ConditionEditor from './ConditionEditor'
import ErrorPolicySelect from './ErrorPolicySelect'

export interface AdvancedSectionProps {
  condition?: Condition
  onError?: ErrorPolicy
  /** Receives `{ condition }` or `{ onError }`; `undefined` values mean "back to the default". */
  onUpdate: (patch: Record<string, unknown>) => void
}

export default function AdvancedSection({ condition, onError, onUpdate }: AdvancedSectionProps) {
  const [open, setOpen] = useState(false)
  const panelId = useId()
  return (
    <div>
      <button type="button" className="text-xs muted underline decoration-dotted py-1" aria-expanded={open}
        aria-controls={open ? panelId : undefined} onClick={() => setOpen(o => !o)}>
        {open ? 'hide advanced' : 'advanced'}
      </button>
      {open && (
        <div id={panelId} className="mt-2 grid gap-4 md:grid-cols-2 bg-surface-2 rounded-xl p-3">
          <div>
            <div className="muted text-xs mb-1">run condition</div>
            <ConditionEditor condition={condition} onChange={c => onUpdate({ condition: c })} />
          </div>
          <div>
            <div className="muted text-xs mb-1">error policy</div>
            <ErrorPolicySelect value={onError} onChange={v => onUpdate({ onError: v })} />
          </div>
        </div>
      )}
    </div>
  )
}
