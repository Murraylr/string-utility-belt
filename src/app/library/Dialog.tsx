import React, { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

export interface DialogProps {
  title: string
  onClose: () => void
  children: React.ReactNode
  className?: string
  /** Rendered after the title, before the close button (tabs, a subtitle, …). */
  headerExtra?: React.ReactNode
  /**
   * Where focus goes on close when whatever had focus on open is gone (or was
   * <body>): e.g. the dialog was opened by a window event from a palette that has
   * since closed. Normally the button that owns the dialog.
   */
  returnFocus?: React.RefObject<HTMLElement | null>
}

const FOCUSABLE = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Accessible modal shell shared by every dialog this workstream owns (share,
 * library, presets): role="dialog", a labelled title, a Tab-cycle focus trap,
 * Escape to close, and focus returned to whatever opened it. Rendered into
 * <body> so a transformed / backdrop-filtered ancestor (a sticky blurred header,
 * an animated card) cannot turn the fixed overlay into a clipped box.
 */
export default function Dialog({ title, onClose, children, className, headerExtra, returnFocus }: DialogProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  // Callers pass inline `onClose` arrows; reading it through a ref keeps the effect
  // below mount-only, so a parent re-render never re-runs it (which would yank focus
  // back to the first control and "return" it to the opener mid-dialog).
  const onCloseRef = useRef(onClose)
  useEffect(() => { onCloseRef.current = onClose })
  const returnFocusRef = useRef(returnFocus)
  useEffect(() => { returnFocusRef.current = returnFocus })

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    const panel = panelRef.current
    // only what Tab can actually reach: a tabindex="-1" control (a roving-tab sibling,
    // a hidden file input) at either end would otherwise let focus leak out
    const focusables = () => (panel
      ? Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(el => el.tabIndex >= 0)
      : [])
    ;(focusables()[0] ?? panel)?.focus()

    const onKeyDown = (e: KeyboardEvent) => {
      // a control inside that consumed Escape (cancel an inline rename, close a menu) wins
      if (e.key === 'Escape') { if (!e.defaultPrevented) { e.preventDefault(); onCloseRef.current() } return }
      if (e.key !== 'Tab') return
      const els = focusables()
      if (!els.length) return
      const idx = els.indexOf(document.activeElement as HTMLElement)
      if (e.shiftKey) {
        if (idx <= 0) { e.preventDefault(); els[els.length - 1].focus() }
      } else if (idx === els.length - 1 || idx === -1) {
        e.preventDefault(); els[0].focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      const target = opener && opener !== document.body && opener.isConnected ? opener : returnFocusRef.current?.current
      target?.focus?.()
    }
  }, [])

  return createPortal(
    <div
      className="fixed inset-0 z-50 grid place-items-center p-4 bg-black/40"
      onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`card w-full max-w-2xl max-h-[85vh] overflow-auto p-5 grid gap-4 content-start outline-hidden ${className ?? ''}`}
      >
        <div className="flex items-center justify-between gap-3">
          <h2 id={titleId} className="text-lg font-semibold">{title}</h2>
          <div className="flex items-center gap-2">
            {headerExtra}
            <button className="icon-btn" aria-label="close dialog" onClick={onClose}><X size={18} /></button>
          </div>
        </div>
        {children}
      </div>
    </div>,
    document.body
  )
}
