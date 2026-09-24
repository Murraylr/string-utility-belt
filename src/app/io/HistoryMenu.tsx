import React, { useCallback, useEffect, useId, useRef, useState } from 'react'
import { History as HistoryIcon, Trash2, X } from 'lucide-react'
import { usePref } from '@/app/prefs'
import { HISTORY_PREF, clearHistory, deleteHistoryEntry, listHistory, type HistoryEntry } from './history'

export interface HistoryMenuProps {
  onRestore: (text: string) => void
}

/** Entries can be a megabyte: only look at the head, never regex the whole text per render. */
function preview(text: string): string {
  const oneLine = text.slice(0, 200).replace(/\s+/g, ' ').trim()
  return oneLine.length > 60 || text.length > 200 ? `${oneLine.slice(0, 60)}…` : oneLine || '(empty)'
}

const tooltip = (text: string) => (text.length > 500 ? `${text.slice(0, 500)}…` : text)

/** "History" disclosure on the input panel: recent text inputs from the IndexedDB-backed ring buffer. */
export default function HistoryMenu({ onRestore }: HistoryMenuProps) {
  const [open, setOpen] = useState(false)
  const [entries, setEntries] = useState<HistoryEntry[]>([])
  const [failed, setFailed] = useState(false)
  const [remember, setRemember] = usePref(HISTORY_PREF, true)
  const containerRef = useRef<HTMLDivElement>(null)
  const toggleRef = useRef<HTMLButtonElement>(null)
  const panelId = useId()

  const refresh = useCallback(() => {
    listHistory()
      .then(list => { setEntries(list); setFailed(false) })
      .catch(() => setFailed(true))
  }, [])

  useEffect(() => {
    if (open) refresh()
  }, [open, refresh])

  const close = useCallback((returnFocus: boolean) => {
    setOpen(false)
    if (returnFocus) toggleRef.current?.focus()
  }, [])

  useEffect(() => {
    if (!open) return undefined
    const onDocMouseDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) close(false)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close(!!containerRef.current?.contains(document.activeElement))
    }
    document.addEventListener('mousedown', onDocMouseDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open, close])

  const remove = async (id: string) => {
    await deleteHistoryEntry(id).catch(() => setFailed(true))
    // the clicked button is gone after the refresh; keep focus inside the widget
    toggleRef.current?.focus()
    refresh()
  }
  const removeAll = async () => {
    await clearHistory().catch(() => setFailed(true))
    toggleRef.current?.focus()
    refresh()
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        ref={toggleRef}
        type="button"
        className="btn"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen(o => !o)}
      >
        <HistoryIcon size={16} /> History
      </button>
      {open && (
        <div id={panelId} className="absolute right-0 z-10 mt-1 w-72 max-w-[calc(100vw-2rem)] max-h-[min(24rem,70vh)] overflow-auto card p-2 grid gap-1" role="region" aria-label="input history">
          {failed && <div className="text-sm text-danger p-2" role="alert">history is unavailable</div>}
          {!failed && entries.length === 0 && <div className="muted text-sm p-2">no history yet</div>}
          {entries.map(e => {
            const label = preview(e.text)
            return (
              <div key={e.id} className="flex items-center gap-1">
                <button
                  type="button"
                  className="btn flex-1 justify-start truncate"
                  title={tooltip(e.text)}
                  aria-label={`restore: ${label}`}
                  onClick={() => { onRestore(e.text); close(true) }}
                >
                  {label}
                </button>
                <button type="button" className="icon-btn" aria-label={`delete: ${label}`} onClick={() => remove(e.id)}>
                  <X size={14} />
                </button>
              </div>
            )
          })}
          <div className="flex items-center justify-between gap-2 mt-1">
            <label className="flex items-center gap-1 text-xs muted">
              <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} />
              remember inputs
            </label>
            {entries.length > 0 && (
              <button type="button" className="btn" onClick={removeAll}>
                <Trash2 size={14} /> clear all
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
