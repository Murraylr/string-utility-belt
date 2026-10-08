import React from 'react'
import type { Suggestion } from '@/core/detect'
import { isEmptyValue } from '@/core/coerce'
import type { Value } from '@/types/utility'
import SuggestionButton from './SuggestionButton'

export interface SuggestionListProps {
  value: Value
  loading: boolean
  error: string | null
  suggestions: Suggestion[]
  onPick: (s: Suggestion) => void
  onDecodeAll: () => void
  decodingAll?: boolean
}

/** Ranked, validated decode candidates for the magic popover. */
export default function SuggestionList({
  value, loading, error, suggestions, onPick, onDecodeAll, decodingAll,
}: SuggestionListProps) {
  const empty = isEmptyValue(value)
  const n = suggestions.length

  return (
    <div className="grid gap-2.5">
      {/* one polite region for every async outcome, so each is announced as it lands */}
      <div role="status" aria-live="polite" className="text-[12.5px] text-muted">
        {loading
          ? 'analysing…'
          : error
            ? null
            : n === 0
              ? empty
                ? "There's nothing to analyse yet. Paste or type some input first."
                : 'Nothing obvious to decode here. Magic spots base64, hex, JWTs, JSON, gzip and more.'
              : <span className="sr-only">{n} decoding suggestion{n === 1 ? '' : 's'}</span>}
      </div>
      {error && <div role="alert" className="text-[12.5px] text-danger-ink">{error}</div>}
      {n > 0 && (
        <ul className="m-0 p-0 list-none grid gap-1" aria-label="decoding suggestions">
          {suggestions.map((s, i) => (
            <li key={`${s.step.utilityId}:${i}`}>
              <SuggestionButton suggestion={s} onPick={onPick} />
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        className="btn-inv h-[30px] w-full"
        disabled={n === 0 || !!decodingAll}
        aria-busy={!!decodingAll}
        onClick={onDecodeAll}
      >
        {decodingAll ? 'decoding…' : 'Decode all the way'}
      </button>
    </div>
  )
}
