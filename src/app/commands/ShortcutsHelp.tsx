/**
 * "?" opens this: every keyboard shortcut in one dialog. Self-contained; mount
 * once at app level alongside `CommandPalette`.
 */
import React, { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { EVENT_OPEN_SHORTCUTS, listShortcuts } from './commands'
import { restoreFocus, trapTabKey, useBackdropDismiss } from './dialogA11y'

export default function ShortcutsHelp() {
  const [open, setOpen] = useState(false)
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const openerRef = useRef<Element | null>(null)
  const backdrop = useBackdropDismiss(() => setOpen(false))

  useEffect(() => {
    const onOpen = () => {
      if (dialogRef.current) return // already open: keep the original opener
      openerRef.current = document.activeElement
      setOpen(true)
    }
    window.addEventListener(EVENT_OPEN_SHORTCUTS, onOpen)
    return () => window.removeEventListener(EVENT_OPEN_SHORTCUTS, onOpen)
  }, [])

  useEffect(() => {
    if (open) closeRef.current?.focus()
    else restoreFocus(openerRef.current)
  }, [open])

  if (!open) return null

  const close = () => setOpen(false)

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center px-4 pt-[9vh] pb-4 bg-black/35" {...backdrop}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-help-title"
        tabIndex={-1}
        className="w-full max-w-[460px] max-h-[calc(91vh-16px)] flex flex-col bg-surface border rounded-[10px] shadow-dialog outline-hidden"
        onKeyDown={e => {
          if (e.key === 'Escape') { e.preventDefault(); close() }
          trapTabKey(e, dialogRef.current)
        }}
      >
        <div className="flex items-center gap-2.5 pl-[18px] pr-3 pt-3.5 pb-3 border-b shrink-0">
          <h2 id="shortcuts-help-title" className="m-0 flex-1 text-[15px] font-semibold">Keyboard shortcuts</h2>
          <button
            ref={closeRef}
            type="button"
            className="grid place-items-center size-7 rounded-[5px] text-muted hover:bg-surface-2 hover:text-fg"
            aria-label="close"
            onClick={close}
          >
            <X size={16} aria-hidden />
          </button>
        </div>
        <dl className="m-0 px-[18px] pt-3.5 pb-[18px] grid gap-2 overflow-auto">
          {listShortcuts().map((s, i) => (
            <div key={i} className="flex items-center justify-between gap-4 text-[13px]">
              <dt className="text-muted">{s.description}</dt>
              <dd className="m-0"><kbd className="font-mono text-[11px] px-1.5 py-0.5 border border-b-2 rounded-[4px] whitespace-nowrap">{s.keys}</kbd></dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  )
}
