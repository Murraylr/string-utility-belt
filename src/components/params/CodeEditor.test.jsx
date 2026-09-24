import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, waitFor, act } from '@testing-library/react'
import { EditorView } from '@codemirror/view'
import CodeEditor from './CodeEditor'

// jsdom has no layout; CodeMirror's measuring only needs these to exist.
beforeAll(() => {
  const rect = { x: 0, y: 0, top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 }
  Range.prototype.getClientRects ??= () => []
  Range.prototype.getBoundingClientRect ??= () => rect
})

const contentOf = container => container.querySelector('.cm-content')

describe('CodeEditor (real CodeMirror in jsdom)', () => {
  it('names the editable surface and wires id / aria-describedby / aria-invalid onto it', async () => {
    const { container } = render(
      <CodeEditor id="p-src" label="source" value="let a = 1" onChange={() => {}} invalid describedBy="p-src-help p-src-error" />
    )
    await waitFor(() => expect(contentOf(container)).toBeTruthy())
    const content = contentOf(container)
    expect(content).toHaveAttribute('id', 'p-src')
    expect(content).toHaveAttribute('aria-label', 'source')
    expect(content.getAttribute('aria-describedby').split(' ')).toEqual(expect.arrayContaining(['p-src-help', 'p-src-error']))
    expect(content).toHaveAttribute('aria-invalid', 'true')
    // only one element carries the id
    expect(container.querySelectorAll('#p-src')).toHaveLength(1)
  })

  it('tells keyboard users how to leave it (Tab indents), and Escape then Tab really does', async () => {
    const { container } = render(<CodeEditor id="k" label="code" value="x" onChange={() => {}} />)
    await waitFor(() => expect(contentOf(container)).toBeTruthy())
    expect(contentOf(container)).toHaveAccessibleDescription(/escape.*tab/i)
    const view = EditorView.findFromDOM(container.querySelector('.cm-editor'))
    view.focus()
    const tab = () => {
      const ev = new KeyboardEvent('keydown', { key: 'Tab', keyCode: 9, bubbles: true, cancelable: true })
      contentOf(container).dispatchEvent(ev)
      return ev.defaultPrevented
    }
    expect(tab()).toBe(true) // captured: indents
    contentOf(container).dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true, cancelable: true }))
    expect(tab()).toBe(false) // left to the browser: moves focus
  })

  it('shows a non-string value as text instead of crashing CodeMirror', async () => {
    const { container } = render(<CodeEditor id="c" label="code" value={42} onChange={() => {}} />)
    await waitFor(() => expect(contentOf(container)).toBeTruthy())
    expect(EditorView.findFromDOM(container.querySelector('.cm-editor')).state.doc.toString()).toBe('42')
  })

  it('reports edits through the latest onChange without reconfiguring the editor on every render', async () => {
    const first = vi.fn()
    const second = vi.fn()
    const { container, rerender } = render(<CodeEditor id="c" label="code" language="plaintext" value="a" onChange={first} />)
    await waitFor(() => expect(container.querySelector('.cm-editor')).toBeTruthy())
    const view = EditorView.findFromDOM(container.querySelector('.cm-editor'))
    const dispatch = vi.spyOn(view, 'dispatch')

    // a parent re-render with a fresh onChange closure (what ParamsEditor does on every keystroke)
    rerender(<CodeEditor id="c" label="code" language="plaintext" value="a" onChange={second} />)
    const reconfigures = dispatch.mock.calls.filter(([spec]) => spec && spec.effects)
    expect(reconfigures).toHaveLength(0)

    act(() => { view.dispatch({ changes: { from: 1, insert: 'b' } }) })
    expect(second).toHaveBeenCalledWith('ab')
    expect(first).not.toHaveBeenCalled()
  })

  it('takes over focus and caret from a placeholder that was focused when it mounted', async () => {
    const { container } = render(
      <CodeEditor id="c" label="code" value="hello" onChange={() => {}} initialFocus={() => ({ anchor: 2, head: 99 })} />
    )
    await waitFor(() => expect(contentOf(container)).toHaveFocus())
    const view = EditorView.findFromDOM(container.querySelector('.cm-editor'))
    expect(view.state.selection.main.anchor).toBe(2)
    expect(view.state.selection.main.head).toBe(5) // clamped to the document
  })

  it('does not grab focus when nothing was focused', async () => {
    const { container } = render(<CodeEditor id="c" label="code" value="x" onChange={() => {}} initialFocus={() => null} />)
    await waitFor(() => expect(contentOf(container)).toBeTruthy())
    expect(contentOf(container)).not.toHaveFocus()
  })
})
