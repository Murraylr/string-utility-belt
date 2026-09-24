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
    <div className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-24 bg-black/40" {...backdrop}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-help-title"
        tabIndex={-1}
        className="card w-full max-w-md p-5 outline-none"
        onKeyDown={e => {
          if (e.key === 'Escape') { e.preventDefault(); close() }
          trapTabKey(e, dialogRef.current)
        }}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 id="shortcuts-help-title" className="font-semibold">Keyboard shortcuts</h2>
          <button ref={closeRef} type="button" className="icon-btn" aria-label="close" onClick={close}>
            <X size={16} />
          </button>
        </div>
        <dl className="grid gap-2 text-sm">
          {listShortcuts().map((s, i) => (
            <div key={i} className="flex items-center justify-between gap-4">
              <dt className="text-muted">{s.description}</dt>
              <dd><kbd className="chip mono">{s.keys}</kbd></dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  )
}
