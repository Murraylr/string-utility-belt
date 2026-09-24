import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import CodeParam from './CodeParam'

// A stale deploy (old chunk hash 404s) or going offline makes the editor chunk fail to load.
const h = vi.hoisted(() => ({ fail: null }))
vi.mock('./CodeEditor', async () => {
  await new Promise(resolve => { h.fail = resolve })
  throw new Error('Failed to fetch dynamically imported module')
})

describe('CodeParam when the editor chunk cannot load', () => {
  it('keeps a working, still-focused plain textarea instead of crashing the page', async () => {
    const onChange = vi.fn()
    render(<CodeParam id="c" spec={{ kind: 'code', label: 'script' }} value="abcdef" onChange={onChange} />)
    const before = screen.getByRole('textbox')
    before.focus()
    before.setSelectionRange(2, 4)

    await waitFor(() => expect(h.fail).toBeTypeOf('function'))
    h.fail()
    // the fallback is swapped for the permanent plain editor
    await waitFor(() => expect(screen.getByRole('textbox')).not.toBe(before))

    const textarea = screen.getByRole('textbox')
    expect(textarea).toHaveValue('abcdef')
    expect(textarea).toHaveAttribute('id', 'c')
    expect(textarea).toHaveFocus()
    expect([textarea.selectionStart, textarea.selectionEnd]).toEqual([2, 4])
    fireEvent.change(textarea, { target: { value: 'abcdefg' } })
    expect(onChange).toHaveBeenCalledWith('abcdefg')
  })
})
