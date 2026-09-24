import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import CodeParam from './CodeParam'

// The editor chunk "arrives" only when the test releases the gate, so the swap from the
// Suspense fallback to the editor can be observed. `lazy` caches per module, so the
// tests below run in order: fallback first, then the swap.
const h = vi.hoisted(() => {
  let release
  const gate = new Promise(resolve => { release = resolve })
  return { gate, release: () => release(), editorProps: [] }
})
vi.mock('./CodeEditor', async () => {
  await h.gate
  const { useState } = await import('react')
  return {
    // Mirrors the real editor: `initialFocus` is read once, while it first renders.
    default: function FakeEditor(props) {
      const [handoff] = useState(() => props.initialFocus?.() ?? null)
      h.editorProps.push({ ...props, handoff })
      return <div data-testid="editor" />
    },
  }
})

const spec = { kind: 'code', label: 'script', language: 'javascript' }

describe('CodeParam', () => {
  it('uses a labelled plain textarea while the editor chunk loads, and keeps edits', () => {
    const onChange = vi.fn()
    render(
      <>
        <label htmlFor="c">script</label>
        <CodeParam id="c" spec={spec} value="let a" onChange={onChange} />
      </>
    )
    const textarea = screen.getByLabelText('script')
    expect(textarea.tagName).toBe('TEXTAREA')
    fireEvent.change(textarea, { target: { value: 'let ab' } })
    expect(onChange).toHaveBeenCalledWith('let ab')
  })

  it('hands focus and the caret to the editor when it replaces a focused fallback', async () => {
    render(<CodeParam id="c" spec={spec} value="hello world" onChange={() => {}} error="bad" describedBy="c-error" />)
    const textarea = screen.getByRole('textbox')
    // focusing does not re-render CodeParam, so the handoff must be read when the editor mounts
    textarea.focus()
    textarea.setSelectionRange(5, 5)

    await act(async () => { h.release(); await h.gate })
    await screen.findByTestId('editor')
    const props = h.editorProps.at(-1)
    expect(props.handoff).toEqual({ anchor: 5, head: 5 })
    expect(props.value).toBe('hello world')
    expect(props.label).toBe('script')
    expect(props.id).toBe('c')
    expect(props.invalid).toBe(true)
    expect(props.describedBy).toBe('c-error')
  })

  it('does not steal focus for an editor whose fallback was never focused', async () => {
    render(<CodeParam id="d" spec={spec} value="x" onChange={() => {}} />)
    await screen.findByTestId('editor')
    expect(h.editorProps.at(-1).handoff).toBeNull()
  })
})
