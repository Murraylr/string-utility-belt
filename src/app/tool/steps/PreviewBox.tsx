/** A compact labelled preview of a value with a copy control (§10.8), for a branch lane's output. */
import React from 'react'
import type { Value } from '@/types/utility'
import { formatForDisplay } from '@/core/coerce'
import CopyAsMenu from '@/components/CopyAsMenu'

export interface PreviewBoxProps {
  label: string
  value: Value
  /** Test/automation hook identifying which preview this is. */
  id?: string
}

export default function PreviewBox({ label, value, id }: PreviewBoxProps) {
  return (
    <div className="grid gap-[3px] min-w-0" data-preview={id ?? label}>
      <div className="flex items-center justify-between gap-2 px-0.5">
        <span className="text-[11px] text-muted">{label}</span>
        <CopyAsMenu value={value} />
      </div>
      <pre className="m-0 px-2 py-1.5 border rounded-[5px] bg-surface font-mono text-[11.5px] leading-[17px] whitespace-pre-wrap wrap-anywhere overflow-auto max-h-[70px]">
        {formatForDisplay(value) || <span className="text-muted">(empty)</span>}
      </pre>
    </div>
  )
}
