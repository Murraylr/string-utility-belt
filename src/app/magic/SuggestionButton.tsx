import React, { useId } from 'react'
import type { Suggestion } from '@/core/detect'

/**
 * One clickable decode suggestion: label, detection confidence and a preview of the
 * decoded value. The preview is the button's description, not part of its name, so a
 * screen reader announces "base64 decode, 82% confidence" rather than 200 characters.
 */
export default function SuggestionButton({ suggestion: s, onPick }: { suggestion: Suggestion; onPick: (s: Suggestion) => void }) {
  const previewId = useId()
  const pct = `${Math.round(s.confidence * 100)}%`
  return (
    <button
      type="button"
      className="w-full text-left p-3 rounded-xl border bg-surface hover:border-primary-600 hover:shadow-glow transition"
      aria-label={`${s.label}, ${pct} confidence`}
      aria-describedby={previewId}
      onClick={() => onPick(s)}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium">{s.label}</span>
        <span className="chip" title="detection confidence">{pct}</span>
      </div>
      <div id={previewId} className="text-xs text-muted mono mt-1 wrap-anywhere line-clamp-3">{s.preview}</div>
    </button>
  )
}
