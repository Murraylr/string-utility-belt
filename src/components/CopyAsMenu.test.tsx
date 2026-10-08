import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import CopyAsMenu from './CopyAsMenu'

/**
 * @testing-library/user-event's setup() always stubs `navigator.clipboard` with its own
 * no-op object (see Clipboard.attachClipboardStubToView), replacing anything defined earlier.
 * So a test must call setup() FIRST, then patch `writeText` on the resulting stub — and userEvent's
 * own afterEach discards that stub (and the patch with it), so this runs fresh per test.
 */
function setupWithClipboard(behavior: 'resolve' | 'reject' = 'resolve') {
  const user = userEvent.setup()
  const writeText =
    behavior === 'resolve' ? vi.fn().mockResolvedValue(undefined) : vi.fn().mockRejectedValue(new Error('denied'))
  Object.defineProperty(navigator.clipboard, 'writeText', { value: writeText, configurable: true })
  return { user, writeText }
}

describe('CopyAsMenu', () => {
  it('copies the raw value on the main button click', async () => {
    const { user, writeText } = setupWithClipboard()
    render(<CopyAsMenu value="hello" label="copy" />)
    await user.click(screen.getByRole('button', { name: 'copy' }))
    expect(writeText).toHaveBeenCalledWith('hello')
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Copied'))
  })

  it('opens the menu and copies as a JSON string literal', async () => {
    const { user, writeText } = setupWithClipboard()
    render(<CopyAsMenu value={'line1\nline2'} label="copy" />)
    await user.click(screen.getByRole('button', { name: 'copy as…' }))
    await user.click(await screen.findByRole('menuitem', { name: /json string literal/i }))
    expect(writeText).toHaveBeenCalledWith(JSON.stringify('line1\nline2'))
  })

  it('copies bytes as hex and as base64', async () => {
    const { user, writeText } = setupWithClipboard()
    render(<CopyAsMenu value={new Uint8Array([0, 255, 16])} label="copy" />)
    await user.click(screen.getByRole('button', { name: 'copy as…' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Hex' }))
    expect(writeText).toHaveBeenCalledWith('00ff10')

    await user.click(screen.getByRole('button', { name: 'copy as…' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Base64' }))
    expect(writeText).toHaveBeenLastCalledWith(btoa(String.fromCharCode(0, 255, 16)))
  })

  it('supports arrow-key navigation within the menu', async () => {
    const { user } = setupWithClipboard()
    render(<CopyAsMenu value="x" label="copy" />)
    await user.click(screen.getByRole('button', { name: 'copy as…' }))
    const items = screen.getAllByRole('menuitem')
    expect(items[0]).toHaveFocus()
    await user.keyboard('{ArrowDown}')
    expect(items[1]).toHaveFocus()
    await user.keyboard('{ArrowUp}')
    expect(items[0]).toHaveFocus()
    await user.keyboard('{End}')
    expect(items[items.length - 1]).toHaveFocus()
  })

  it('shows an error when the clipboard write fails', async () => {
    const { user } = setupWithClipboard('reject')
    render(<CopyAsMenu value="x" label="copy" />)
    await user.click(screen.getByRole('button', { name: 'copy' }))
    expect(await screen.findByText('Failed')).toBeTruthy()
  })

  it('is icon-only with an accessible name when no label is given', () => {
    render(<CopyAsMenu value="x" />)
    expect(screen.getByRole('button', { name: 'copy' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'copy as…' })).toBeTruthy()
  })

  it('opens from the keyboard with ArrowDown/ArrowUp on the menu button', async () => {
    const { user } = setupWithClipboard()
    render(<CopyAsMenu value="x" label="copy" />)
    screen.getByRole('button', { name: 'copy as…' }).focus()
    await user.keyboard('{ArrowDown}')
    expect(screen.getAllByRole('menuitem')[0]).toHaveFocus()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('menu')).toBeNull()
    expect(screen.getByRole('button', { name: 'copy as…' })).toHaveFocus()
    await user.keyboard('{ArrowUp}')
    const items = screen.getAllByRole('menuitem')
    expect(items[items.length - 1]).toHaveFocus()
  })

  it('copies strings as UTF-8 hex/base64 and json values via their text form', async () => {
    const { user, writeText } = setupWithClipboard()
    const { rerender } = render(<CopyAsMenu value="é" label="copy" />)
    await user.click(screen.getByRole('button', { name: 'copy as…' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Hex' }))
    expect(writeText).toHaveBeenLastCalledWith('c3a9')
    await user.click(screen.getByRole('button', { name: 'copy as…' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Base64' }))
    expect(writeText).toHaveBeenLastCalledWith('w6k=')
    rerender(<CopyAsMenu value={{ a: 1 }} label="copy" />)
    await user.click(screen.getByRole('button', { name: 'copy as…' }))
    await user.click(await screen.findByRole('menuitem', { name: /json string literal/i }))
    expect(writeText).toHaveBeenLastCalledWith(JSON.stringify('{\n  "a": 1\n}'))
  })
})
