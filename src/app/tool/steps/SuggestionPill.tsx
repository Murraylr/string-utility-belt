/**
 * A compact decode suggestion: the decoder's name and how sure the detection is, with
 * the decoded preview as its description (and tooltip), so a screen reader announces
 * "base64 decode, 82% confidence" rather than 200 characters.
 */
import React, { useId } from 'react'
import { WandSparkles } from 'lucide-react'
import type { Suggestion } from '@/core/detect'

export interface SuggestionPillProps {
  suggestion: Suggestion
  onPick: (s: Suggestion) => void
  /** The dashed "next step" hint after the add buttons, rather than a plain pill. */
  hint?: boolean
}

export default function SuggestionPill({ suggestion: s, onPick, hint }: SuggestionPillProps) {
  const previewId = useId()
  const pct = `${Math.round(s.confidence * 100)}%`
  return (
    <button type="button" title={s.preview} aria-label={`${s.label}, ${pct} confidence`} aria-describedby={previewId}
      onClick={() => onPick(s)}
      className={`inline-flex items-center gap-[7px] h-[30px] px-2.5 rounded-md text-[12.5px] min-w-0 hover:border-acc ${hint ? 'border border-dashed border-line-2 hover:border-solid' : 'border bg-surface'}`}>
      {hint && <WandSparkles size={13} className="shrink-0 text-acc" aria-hidden="true" />}
      {hint && <span className="text-muted">Next:</span>}
      <span className="font-medium truncate">{s.label}</span>
      <span className="font-mono text-[10.5px] text-muted">{pct}</span>
      <span id={previewId} className="sr-only">{s.preview}</span>
    </button>
  )
}
