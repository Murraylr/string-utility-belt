import React, { useMemo } from 'react'
import type { Value } from '@/types/utility'
import { computeStats } from './stats'

export interface StatsBarProps {
  value: Value
  className?: string
}

const TYPE_LABEL = { string: 'text', json: 'json', bytes: 'bytes' } as const

const plural = (n: number, one: string) => `${n.toLocaleString()} ${one}${n === 1 ? '' : 's'}`

/** Always-visible type/lines/words/chars/bytes readout for an input or output value. */
export default function StatsBar({ value, className }: StatsBarProps) {
  // memoised: the host panels re-render on caret moves and run-state flips, not just value changes
  const s = useMemo(() => computeStats(value), [value])
  const parts: string[] =
    s.type === 'bytes'
      ? [TYPE_LABEL.bytes, plural(s.utf8Bytes, 'byte')]
      : [
          TYPE_LABEL[s.type],
          plural(s.lines!, 'line'),
          plural(s.words!, 'word'),
          plural(s.codePoints!, 'char'),
          plural(s.utf8Bytes, 'byte'),
        ]
  return (
    <div className={`flex flex-wrap gap-x-3.5 font-mono text-[11px] text-muted ${className ?? ''}`} data-testid="stats-bar">
      {parts.map((p, i) => <span key={i}>{p}</span>)}
    </div>
  )
}
