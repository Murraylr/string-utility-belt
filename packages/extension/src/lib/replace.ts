/**
 * Functions injected into the page with `chrome.scripting.executeScript`,
 * which serializes them with `Function.prototype.toString`. Each must be fully
 * self-contained — no references to anything outside its own body (helpers are
 * repeated inside each on purpose) — which also makes them easy to test head-on
 * against jsdom.
 */

/** What `readSelection` found: the text to transform, and whether it is the
 * whole value of an editable field that had nothing selected. */
export interface PageSelection {
  text: string
  whole: boolean
}

/**
 * Injected first, into the frame the menu was opened in: the exact selected
 * text. The context menu's own `selectionText` replaces line breaks with
 * spaces (crbug.com/40740672), which would corrupt multi-line text once the
 * result is written back. With nothing selected in a focused text field (the
 * menu's 'editable' context) it returns the field's whole value instead.
 * Password fields are never read. `null` when there is nothing to act on.
 */
export function readSelection(): PageSelection | null {
  const FIELD_TYPES = ['text', 'search', 'url', 'tel']
  let active: Element | null = document.activeElement
  while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement

  if (active && active.tagName === 'INPUT' && (active as HTMLInputElement).type === 'password') return null
  const isField = !!active &&
    (active.tagName === 'TEXTAREA' || (active.tagName === 'INPUT' && FIELD_TYPES.includes((active as HTMLInputElement).type)))
  if (isField) {
    const el = active as HTMLInputElement | HTMLTextAreaElement
    const start = el.selectionStart
    const end = el.selectionEnd
    if (start !== null && end !== null) {
      return start === end ? { text: el.value, whole: true } : { text: el.value.slice(start, end), whole: false }
    }
  }
  const text = window.getSelection()?.toString() ?? ''
  return text ? { text, whole: false } : null
}

/**
 * Injected second: writes `text` over the selection in the frame's focused
 * editable element (text input, textarea or contenteditable) — or, when `whole`,
 * over that field's entire value — and resolves `true`. It only writes when
 * the selection (or value) still equals `expected`, the text that was
 * transformed; otherwise (the selection is in non-editable page text, or it
 * moved while the utility ran) it copies `text` to the clipboard and resolves
 * `false`, never overwriting the wrong text. `expected: null` means copy only.
 *
 * Writes go through `execCommand('insertText')` first so the page's undo stack
 * and rich editors' own input handling keep working, with a direct DOM edit
 * plus `input` event as the fallback.
 */
export async function replaceSelectionOrCopy(text: string, expected: string | null, whole: boolean): Promise<boolean> {
  const FIELD_TYPES = ['text', 'search', 'url', 'tel']

  function execInsert(): boolean {
    try {
      return typeof document.execCommand === 'function' && document.execCommand('insertText', false, text)
    } catch {
      return false
    }
  }

  function editableRoot(el: Element | null): HTMLElement | null {
    for (let node = el as HTMLElement | null; node; node = node.parentElement) {
      // jsdom computes neither `isContentEditable` nor the attribute's reflection, so check both forms.
      const mode = node.getAttribute?.('contenteditable') ?? node.contentEditable
      if (mode === 'false') return null
      if (node.isContentEditable || mode === '' || mode === 'true' || mode === 'plaintext-only') return node
    }
    return null
  }

  function writeField(el: HTMLInputElement | HTMLTextAreaElement): boolean {
    const before = el.value
    if (whole) {
      if (before !== expected) return false
      el.setSelectionRange(0, before.length)
    }
    const start = el.selectionStart
    const end = el.selectionEnd
    if (start === null || end === null || before.slice(start, end) !== expected) return false
    if (execInsert() && el.value !== before) return true
    el.value = before.slice(0, start) + text + before.slice(end)
    const caret = start + text.length
    el.setSelectionRange(caret, caret)
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
    return true
  }

  function writeEditable(root: HTMLElement): boolean {
    const selection = window.getSelection()
    if (whole || !selection || selection.rangeCount === 0 || selection.toString() !== expected) return false
    const range = selection.getRangeAt(0)
    if (!root.contains(range.commonAncestorContainer)) return false
    if (execInsert()) return true
    range.deleteContents()
    const node = document.createTextNode(text)
    range.insertNode(node)
    range.setStartAfter(node)
    range.collapse(true)
    selection.removeAllRanges()
    selection.addRange(range)
    root.dispatchEvent(new Event('input', { bubbles: true }))
    return true
  }

  async function copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(text)
      return
    } catch {
      // Not focused / not permitted: fall back to a throwaway textarea, which
      // the extension's clipboardWrite permission lets injected code copy from.
    }
    if (!document.body) return
    const previous = document.activeElement as HTMLElement | null
    const selection = window.getSelection()
    const ranges: Range[] = []
    for (let i = 0; selection && i < selection.rangeCount; i++) ranges.push(selection.getRangeAt(i))
    const area = document.createElement('textarea')
    area.value = text
    area.setAttribute('readonly', '')
    area.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none'
    document.body.appendChild(area)
    area.focus()
    area.select()
    try { document.execCommand?.('copy') } catch { /* nothing more to try */ }
    area.remove()
    previous?.focus?.()
    if (selection) {
      selection.removeAllRanges()
      for (const r of ranges) selection.addRange(r)
    }
  }

  if (expected !== null) {
    let active: Element | null = document.activeElement
    while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement
    const field = active as HTMLInputElement | HTMLTextAreaElement | null
    const isField = !!field && !field.readOnly && !field.disabled &&
      (field.tagName === 'TEXTAREA' || (field.tagName === 'INPUT' && FIELD_TYPES.includes(field.type)))
    if (isField) {
      if (writeField(field)) return true
    } else {
      const root = editableRoot(active)
      if (root && writeEditable(root)) return true
    }
  }
  await copy()
  return false
}
