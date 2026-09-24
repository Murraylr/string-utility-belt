import React, { useMemo } from 'react'
import type { Value } from '@/types/utility'
import { computeStats } from './stats'

export interface StatsBarProps {
  value: Value
  /** Compact input-panel variant vs. the fuller output variant. */
  compact?: boolean
}

const TYPE_LABEL = { string: 'text', json: 'json', bytes: 'bytes' } as const

const plural = (n: number, one: string) => `${n.toLocaleString()} ${one}${n === 1 ? '' : 's'}`

/** Always-visible type/lines/words/chars/bytes readout for an input or output value. */
export default function StatsBar({ value, compact }: StatsBarProps) {
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
    <div className={`muted ${compact ? 'text-xs' : 'text-sm'}`} data-testid="stats-bar">
      {parts.join(' · ')}
    </div>
  )
}
