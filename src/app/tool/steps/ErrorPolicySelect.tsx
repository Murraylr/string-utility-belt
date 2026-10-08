/** Per-step error policy control (§8.11). `undefined` means the default: passthrough. */
import React from 'react'
import type { ErrorPolicy } from '@/types/utility'

export interface ErrorPolicySelectProps {
  value?: ErrorPolicy
  onChange: (value: ErrorPolicy | undefined) => void
}

const OPTIONS: Array<{ value: ErrorPolicy; label: string }> = [
  { value: 'passthrough', label: 'continue with its input' },
  { value: 'stop', label: 'stop the pipeline' },
  { value: 'empty', label: 'continue with empty output' },
]

export default function ErrorPolicySelect({ value, onChange }: ErrorPolicySelectProps) {
  const current = value ?? 'passthrough'
  return (
    <select className="field h-[30px] min-w-0" aria-label="on error" value={current}
      onChange={e => onChange(e.target.value === 'passthrough' ? undefined : (e.target.value as ErrorPolicy))}>
      {OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
}
