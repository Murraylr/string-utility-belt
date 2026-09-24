/** A compact labelled preview of a value with a copy control (§10.8), for branch lanes and macro/branch outputs. */
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
    <div className="bg-surface-2 rounded-lg p-2 text-xs" data-preview={id ?? label}>
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="muted">{label}</span>
        <CopyAsMenu value={value} />
      </div>
      <pre className="font-mono whitespace-pre-wrap [overflow-wrap:anywhere] overflow-auto max-h-40">{formatForDisplay(value)}</pre>
    </div>
  )
}
