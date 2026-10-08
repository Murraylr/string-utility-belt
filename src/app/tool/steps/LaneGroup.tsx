/** A dashed box holding a nested sequence inside a container card: a branch lane, or a macro or "run on each" body. */
import React from 'react'

export interface LaneGroupProps {
  /** Visible heading ("Lane 1", "Steps in this macro"). */
  title: string
  /** The group's accessible name; defaults to the title. */
  label?: string
  /** A muted note after the title. */
  note?: React.ReactNode
  /** Controls at the end of the heading row (remove lane). */
  actions?: React.ReactNode
  id?: string
  children: React.ReactNode
}

export default function LaneGroup({ title, label, note, actions, id, children }: LaneGroupProps) {
  return (
    <div id={id} role="group" aria-label={label ?? title}
      className="grid gap-1.5 content-start min-w-0 p-2 border border-dashed border-line-2 rounded-[7px] bg-canvas">
      <div className="flex items-center gap-2 px-0.5 min-h-[22px]">
        <span className="text-xs font-medium">{title}</span>
        <span className="flex-1 min-w-0 text-[11.5px] text-muted">{note}</span>
        {actions}
      </div>
      {children}
    </div>
  )
}
