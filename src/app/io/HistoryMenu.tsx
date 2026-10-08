import React, { useCallback, useEffect, useId, useRef, useState } from 'react'
import { History as HistoryIcon, X } from 'lucide-react'
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
        className="btn-ghost"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen(o => !o)}
      >
        <HistoryIcon size={14} aria-hidden /> History
      </button>
      {open && (
        <div id={panelId} className="popover absolute right-0 top-8 z-25 w-[300px] max-w-[calc(100vw-2rem)] max-h-[min(360px,70vh)] overflow-auto" role="region" aria-label="Input history">
          {failed && <div className="p-2.5 text-[12.5px] text-danger" role="alert">History isn&apos;t available in this browser.</div>}
          {!failed && entries.length === 0 && (
            <div className="p-2.5 text-[12.5px] text-muted">No history yet. Inputs show up here a couple of seconds after you stop typing.</div>
          )}
          {entries.map(e => {
            const label = preview(e.text)
            return (
              <div key={e.id} className="flex items-center gap-0.5">
                <button
                  type="button"
                  className="flex-1 min-w-0 text-left px-2.5 py-[7px] rounded-[5px] font-mono text-xs truncate hover:bg-surface-2"
                  title={tooltip(e.text)}
                  aria-label={`restore: ${label}`}
                  onClick={() => { onRestore(e.text); close(true) }}
                >
                  {label}
                </button>
                <button type="button" className="icon-btn min-w-[26px] min-h-[26px] p-1" aria-label={`delete: ${label}`} onClick={() => remove(e.id)}>
                  <X size={13} aria-hidden />
                </button>
              </div>
            )
          })}
          <div className="flex items-center justify-between gap-2 px-2.5 pt-2 pb-1.5 mt-1 border-t">
            <label className="flex items-center gap-1.5 text-xs text-muted cursor-pointer">
              <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} />
              Remember inputs
            </label>
            {entries.length > 0 && (
              <button type="button" className="h-6 px-2 rounded-[5px] text-xs text-muted hover:bg-surface-2 hover:text-danger" onClick={removeAll}>
                Clear all
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
