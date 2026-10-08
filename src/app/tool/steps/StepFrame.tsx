/**
 * The shell every step card shares (utility, branch, macro, "run on each"): the header
 * (title, sub line, chips, description; signature, timing, on/off switch, actions menu,
 * delete), then the card's own body, its output strip, and the error or skip note.
 * Nested cards (inside a lane or body) render compact.
 */
import React from 'react'
import { X } from 'lucide-react'
import type { ErrorPolicy } from '@/types/utility'
import type { SkipReason } from '@/core/runner'
import StepMenu, { type StepMenuProps } from './StepMenu'
import { useStepDepth } from './depth'
import { POLICY_NOTE, SKIP_NOTE, SLOW_MS, formatMs, stateToneClass } from './status'

export interface StepFrameProps {
  stepId: string
  index: number
  total: number
  enabled: boolean
  /** The step's name, as a control or text. */
  title: React.ReactNode
  /** One muted line after the title (the category, "parallel lanes"…). */
  sub?: React.ReactNode
  chips?: React.ReactNode
  description?: React.ReactNode
  /** `accepts → produces`; hidden on nested cards. */
  signature?: string
  ms?: number
  error?: string
  /** Overrides the error policy's note after the message; `null` shows none. */
  errorNote?: string | null
  onError?: ErrorPolicy
  skipped?: SkipReason | string
  onToggle: (enabled: boolean) => void
  onDelete: () => void
  menu: Omit<StepMenuProps, 'index' | 'total' | 'onDelete'>
  /** The card's output strip, after the body. */
  output?: React.ReactNode
  children?: React.ReactNode
}

/** The on/off switch in a card header. */
function StepSwitch({ index, enabled, onToggle }: { index: number; enabled: boolean; onToggle: (v: boolean) => void }) {
  const hint = enabled ? 'Turn step off' : 'Turn step on'
  return (
    <button type="button" role="switch" aria-checked={enabled} aria-label={`toggle step ${index + 1}`} title={hint}
      className="w-[34px] h-7 grid place-items-center rounded-[5px] hover:bg-surface-2" onClick={() => onToggle(!enabled)}>
      <span className={`relative block w-6 h-3.5 rounded-full transition-colors ${enabled ? 'bg-acc' : 'bg-line-2'}`}>
        <span className={`absolute top-0.5 size-2.5 rounded-full bg-surface transition-[left] ${enabled ? 'left-3' : 'left-0.5'}`} />
      </span>
    </button>
  )
}

export default function StepFrame({
  stepId, index, total, enabled, title, sub, chips, description, signature, ms, error, errorNote, onError, skipped,
  onToggle, onDelete, menu, output, children,
}: StepFrameProps) {
  const nested = useStepDepth() > 0
  const failed = !!error && enabled
  const note = errorNote === undefined ? POLICY_NOTE[onError ?? 'passthrough'] : errorNote
  const skipNote = !enabled ? SKIP_NOTE.disabled : skipped ? SKIP_NOTE[skipped as SkipReason] : undefined

  return (
    <article data-step-id={stepId}
      className={`flex-1 min-w-0 border rounded-lg bg-surface ${enabled ? '' : 'opacity-[.62]'} ${stateToneClass(skipped, failed ? error : undefined)}`}>
      <div className={`flex flex-wrap items-start gap-x-2.5 gap-y-1 ${nested ? 'pl-2.5 pr-1 pt-1.5 pb-1.5' : 'pl-3.5 pr-2 pt-[11px] pb-2.5'}`}>
        <div className="flex-1 min-w-[min(100%,12rem)] grid gap-[3px]">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 min-w-0">
            {title}
            {sub && <span className="text-xs text-muted">{sub}</span>}
            {chips}
          </div>
          {description && !nested && <div className="text-[12.5px] text-muted text-pretty">{description}</div>}
        </div>
        <div className="flex items-center gap-0.5 shrink-0 ml-auto relative">
          {signature && !nested && <span className="font-mono text-[11px] text-muted px-1.5 whitespace-nowrap">{signature}</span>}
          {ms !== undefined && (
            <span title="Time spent in this step"
              className={`font-mono text-[11px] tabular-nums text-right whitespace-nowrap pr-1.5 ${nested ? '' : 'min-w-10'} ${ms > SLOW_MS ? 'text-warn' : 'text-muted'}`}>
              {formatMs(ms)}
            </span>
          )}
          <StepSwitch index={index} enabled={enabled} onToggle={onToggle} />
          <StepMenu index={index} total={total} onDelete={onDelete} {...menu} />
          <button type="button" aria-label={`delete step ${index + 1}`} title="Delete step" onClick={onDelete}
            className="size-7 grid place-items-center rounded-[5px] text-muted hover:bg-danger-bg hover:text-danger">
            <X size={15} aria-hidden="true" />
          </button>
        </div>
      </div>
      {children}
      {output}
      {failed && (
        <div role="alert" className="px-3.5 py-[9px] border-t border-danger-line bg-danger-bg text-[12.5px] text-danger-ink last:rounded-b-[7px] wrap-anywhere">
          {error}
          {note && <span className="text-muted"> {note}</span>}
        </div>
      )}
      {skipNote && <div className="px-3.5 py-2 border-t text-xs text-muted last:rounded-b-[7px]">{skipNote}</div>}
    </article>
  )
}
