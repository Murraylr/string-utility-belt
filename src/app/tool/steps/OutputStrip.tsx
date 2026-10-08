/**
 * The strip at the foot of a step card: the step's output from the last run, with a
 * copy menu and, when the step's input was recorded, a line diff against it (§8.10).
 */
import React, { useState } from 'react'
import type { Value } from '@/types/utility'
import { formatForDisplay } from '@/core/coerce'
import CopyAsMenu from '@/components/CopyAsMenu'
import StepDiff from './StepDiff'
import { useStepDepth } from './depth'

export interface OutputStripProps {
  label: string
  value: Value
  /** The step's input; enables the diff toggle. */
  input?: Value
  /** Test/automation hook identifying which preview this is. */
  id?: string
}

export default function OutputStrip({ label, value, input, id }: OutputStripProps) {
  const [showDiff, setShowDiff] = useState(false)
  const nested = useStepDepth() > 0
  return (
    <div className="border-t bg-strip last:rounded-b-[7px] min-w-0" data-preview={id ?? label}>
      <div className="flex items-center gap-1 pl-3.5 pr-1.5 pt-1">
        <span className="text-[11px] text-muted">{label}</span>
        <div className="flex-1" />
        {input !== undefined && (
          <button type="button" aria-pressed={showDiff} title="Compare with this step’s input" onClick={() => setShowDiff(d => !d)}
            className="h-[22px] px-[7px] rounded-[4px] text-[11.5px] text-muted hover:bg-surface-2 hover:text-fg aria-pressed:bg-surface-2 aria-pressed:text-fg">
            Diff
          </button>
        )}
        <CopyAsMenu value={value} />
      </div>
      {showDiff && input !== undefined
        ? <StepDiff before={input} after={value} />
        : (
          <pre className={`m-0 px-3.5 pt-1 pb-2.5 font-mono whitespace-pre-wrap wrap-anywhere overflow-auto ${nested ? 'text-[11.5px] leading-[17px] max-h-[86px]' : 'text-[12.5px] leading-[19px] max-h-[118px]'}`}>
            {formatForDisplay(value) || <span className="text-muted">(empty)</span>}
          </pre>
        )}
    </div>
  )
}
