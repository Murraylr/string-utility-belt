/**
 * Global keyboard shortcuts. Mount once at app level (`useShortcuts()` inside a
 * top-level component) — it never touches React state, only dispatches the same
 * window events a menu item or the palette itself would.
 */
import { useEffect } from 'react'
import { dispatchToolCommand, EVENT_OPEN_PALETTE, EVENT_OPEN_SHORTCUTS } from './commands'

/** Marks the command palette's dialog, the one modal the global shortcuts still serve. */
export const PALETTE_DIALOG_ATTR = 'data-command-palette'

/** The modal dialog currently on screen, if any (a hidden or closed one does not count). */
function openModal(): Element | null {
  for (const el of Array.from(document.querySelectorAll('[aria-modal="true"]'))) {
    if (el.closest('[hidden]')) continue
    if (el.tagName === 'DIALOG' && !el.hasAttribute('open')) continue
    return el
  }
  return null
}

/** `<input>` types with no text caret (so no native text undo to protect). */
const NON_TEXT_INPUTS = new Set(['checkbox', 'radio', 'range', 'color', 'button', 'submit', 'reset', 'image', 'file', 'hidden'])

function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  if (!el || typeof el.tagName !== 'string') return false
  const tag = el.tagName
  if (tag === 'INPUT') return !NON_TEXT_INPUTS.has((el as HTMLInputElement).type)
  return tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable
}

/** Letter keys by physical position too, so Ctrl+K etc. work on non-Latin layouts. */
function letter(e: KeyboardEvent): string {
  const key = e.key.toLowerCase()
  if (/^[a-z]$/.test(key)) return key
  const m = /^Key([A-Z])$/.exec(e.code || '')
  return m ? m[1].toLowerCase() : key
}

export function useShortcuts(): void {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // someone closer to the focus already handled it (an editor, a menu, the picker)
      if (e.defaultPrevented || e.isComposing) return
      const modal = openModal()
      const inPalette = !!modal && modal.hasAttribute(PALETTE_DIALOG_ATTR)
      // another modal dialog (share, library, help…) owns the keyboard until it closes
      if (modal && !inPalette) return

      const mod = e.ctrlKey || e.metaKey
      const key = letter(e)

      // Ctrl/Cmd+K: always, even while typing — the universal palette shortcut (toggles).
      if (mod && !e.shiftKey && !e.altKey && key === 'k') {
        e.preventDefault()
        // a toggle: a held key's auto-repeat would flicker the palette open and shut
        if (!e.repeat) window.dispatchEvent(new CustomEvent(EVENT_OPEN_PALETTE))
        return
      }
      // Ctrl/Cmd+Enter: run now, even inside the input textarea.
      if (mod && !e.shiftKey && !e.altKey && e.key === 'Enter') {
        e.preventDefault()
        dispatchToolCommand({ command: 'runNow' })
        return
      }

      if (inPalette || isTypingTarget(e.target)) return

      // Ctrl/Cmd+Z: undo. Ctrl/Cmd+Shift+Z or Ctrl+Y: redo.
      if (mod && !e.shiftKey && !e.altKey && key === 'z') {
        e.preventDefault()
        dispatchToolCommand({ command: 'undo' })
        return
      }
      if (!e.altKey && ((mod && e.shiftKey && key === 'z') || (e.ctrlKey && !e.metaKey && !e.shiftKey && key === 'y'))) {
        e.preventDefault()
        dispatchToolCommand({ command: 'redo' })
        return
      }
      if (!mod && !e.altKey && e.key === '?') {
        e.preventDefault()
        window.dispatchEvent(new CustomEvent(EVENT_OPEN_SHORTCUTS))
        return
      }
      if (!mod && !e.altKey && e.key === '/') {
        e.preventDefault()
        window.dispatchEvent(new CustomEvent(EVENT_OPEN_PALETTE))
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}
