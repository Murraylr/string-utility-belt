/** A text field for a separator (a branch merge, a "run on each" delimiter) that shows control characters escaped. */
import React, { useState } from 'react'

const ESCAPES: Record<string, string> = { '\\': '\\\\', '\n': '\\n', '\t': '\\t', '\r': '\\r' }
const UNESCAPES: Record<string, string> = { '\\\\': '\\', '\\n': '\n', '\\t': '\t', '\\r': '\r' }

/** Control characters shown as their escape sequence in the separator field (`\n` → `\\n`). */
const escapeSeparator = (s: string) => s.replace(/[\\\n\t\r]/g, m => ESCAPES[m])
const unescapeSeparator = (s: string) => s.replace(/\\[\\ntr]/g, m => UNESCAPES[m])

export interface SeparatorFieldProps {
  label: string
  value: string
  onChange: (v: string) => void
  /** When false, committing an empty field reverts it instead (a delimiter must split on something). */
  allowEmpty?: boolean
  /** Longest draft accepted; an escaped draft is never shorter than the separator it stands for. */
  maxLength?: number
}

/**
 * The separator field edits its own draft text and commits once (blur or Enter), so a
 * typed separator is one undo entry, and a half-typed `\` is never re-derived as `\\`
 * before the `n` arrives. Escape reverts; the draft resyncs only when the stored
 * separator changes from elsewhere (undo, mode switch).
 */
export default function SeparatorField({ label, value, onChange, allowEmpty = true, maxLength }: SeparatorFieldProps) {
  const [draft, setDraft] = useState(() => escapeSeparator(value))
  const [synced, setSynced] = useState(value)
  if (value !== synced) { setSynced(value); setDraft(escapeSeparator(value)) }
  const commit = () => {
    const next = unescapeSeparator(draft)
    if (!next && !allowEmpty) { setDraft(escapeSeparator(value)); return }
    if (next !== value) onChange(next)
  }
  return (
    <input className="field w-28" aria-label={label} value={draft} maxLength={maxLength}
      onChange={e => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={e => {
        if (e.key === 'Enter') { e.preventDefault(); commit() }
        if (e.key === 'Escape') { e.preventDefault(); setDraft(escapeSeparator(value)) }
      }} />
  )
}
