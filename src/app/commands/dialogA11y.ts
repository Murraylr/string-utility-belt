/**
 * Shared bits for the palette and shortcuts-help dialogs: a Tab focus trap,
 * backdrop dismissal, and restoring focus to the element that opened the dialog.
 */
import { useRef, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent } from 'react'

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

/**
 * Keep Tab / Shift+Tab cycling within `container` instead of leaving the dialog,
 * including when focus sits on the container itself (after a click on its body).
 */
export function trapTabKey(e: ReactKeyboardEvent, container: HTMLElement | null): void {
  if (e.key !== 'Tab' || !container) return
  const nodes = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE))
    .filter(el => !el.hasAttribute('disabled'))
  if (!nodes.length) { e.preventDefault(); return }
  const first = nodes[0]
  const last = nodes[nodes.length - 1]
  const active = document.activeElement as HTMLElement | null
  const inside = !!active && nodes.includes(active)
  if (e.shiftKey && (active === first || !inside)) { e.preventDefault(); last.focus() }
  else if (!e.shiftKey && (active === last || !inside)) { e.preventDefault(); first.focus() }
}

/**
 * Backdrop handlers that dismiss only on a genuine click on the backdrop: a press
 * that starts inside the dialog (e.g. selecting text in the search box) and is
 * released over the backdrop must not close it.
 */
export function useBackdropDismiss(onDismiss: () => void) {
  const pressedOnBackdrop = useRef(false)
  return {
    onMouseDown: (e: ReactMouseEvent) => { pressedOnBackdrop.current = e.target === e.currentTarget },
    onClick: (e: ReactMouseEvent) => {
      if (pressedOnBackdrop.current && e.target === e.currentTarget) onDismiss()
      pressedOnBackdrop.current = false
    },
  }
}

/** Focus `el` if it is still in the document (the opener may have unmounted meanwhile). */
export function restoreFocus(el: Element | null): void {
  if (el && el.isConnected && typeof (el as HTMLElement).focus === 'function') (el as HTMLElement).focus()
}
