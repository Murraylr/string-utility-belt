/** Per-step error policy control (§8.11). `undefined` means the default: passthrough. */
import React from 'react'
import type { ErrorPolicy } from '@/types/utility'

export interface ErrorPolicySelectProps {
  value?: ErrorPolicy
  onChange: (value: ErrorPolicy | undefined) => void
}

const OPTIONS: Array<{ value: ErrorPolicy; label: string }> = [
  { value: 'passthrough', label: 'continue with input (passthrough)' },
  { value: 'stop', label: 'stop the pipeline' },
  { value: 'empty', label: 'continue with empty output' },
]

export default function ErrorPolicySelect({ value, onChange }: ErrorPolicySelectProps) {
  const current = value ?? 'passthrough'
  return (
    <label className="flex items-center gap-2 text-sm flex-wrap">
      <span className="muted">on error</span>
      <select className="field" aria-label="on error" value={current}
        onChange={e => onChange(e.target.value === 'passthrough' ? undefined : (e.target.value as ErrorPolicy))}>
        {OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  )
}
