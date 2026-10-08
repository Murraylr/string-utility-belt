import React, { useId } from 'react'
import { Plus } from 'lucide-react'
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
      className="w-full flex items-center justify-between gap-2.5 text-left px-2.5 py-2 border rounded-md bg-surface hover:border-acc"
      aria-label={`${s.label}, ${pct} confidence`}
      aria-describedby={previewId}
      onClick={() => onPick(s)}
    >
      <span className="grid gap-0.5 min-w-0">
        <span className="flex items-center gap-2">
          <span className="text-[13px] font-medium">{s.label}</span>
          <span className="chip" title="detection confidence">{pct}</span>
        </span>
        <span id={previewId} className="font-mono text-xs text-muted wrap-anywhere line-clamp-2">{s.preview}</span>
      </span>
      <Plus size={14} className="shrink-0 text-muted" aria-hidden />
    </button>
  )
}
