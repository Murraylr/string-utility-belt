import React, { memo, useMemo, useState } from 'react'
import { formatOffset, hexDumpRows } from './hex'

const INITIAL_BYTES = 64 * 1024
const REVEAL_STEP = 64 * 1024

export interface HexViewProps {
  bytes: Uint8Array
}

function HexView({ bytes }: HexViewProps) {
  // "show more" belongs to the value it was clicked for: a new output starts back at the cap
  const [reveal, setReveal] = useState({ bytes, extra: 0 })
  const extra = reveal.bytes === bytes ? reveal.extra : 0
  const shown = Math.min(INITIAL_BYTES + extra, bytes.length)
  const rows = useMemo(() => hexDumpRows(bytes, 0, shown), [bytes, shown])

  return (
    <div className="grid gap-2">
      <div className="border rounded-2xl p-3 bg-surface overflow-auto max-h-80 mono text-xs" role="table" aria-label="hex view" tabIndex={0}>
        {rows.map(r => (
          <div key={r.offset} role="row" className="whitespace-pre">
            <span role="cell" className="text-muted">{formatOffset(r.offset)}  </span>
            <span role="cell">{r.hex.padEnd(16 * 3 - 1, ' ')}  </span>
            <span role="cell" className="text-muted">{r.ascii}</span>
          </div>
        ))}
      </div>
      {shown < bytes.length && (
        <button type="button" className="btn justify-self-start" onClick={() => setReveal({ bytes, extra: extra + REVEAL_STEP })}>
          show more ({(bytes.length - shown).toLocaleString()} bytes left)
        </button>
      )}
    </div>
  )
}

/**
 * offset | hex | ascii dump of a byte value, capped at 64 KB with a manual "show more".
 * Memoised: its host re-renders on every run-state flip, and re-diffing thousands of rows each time is waste.
 */
export default memo(HexView)
