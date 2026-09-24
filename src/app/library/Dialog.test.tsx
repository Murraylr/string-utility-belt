import React, { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Dialog from './Dialog'

function Opener({ onClose }: { onClose?: () => void }) {
  const [open, setOpen] = useState(false)
  const [, setTick] = useState(0)
  return (
    <>
      <button onClick={() => setOpen(true)}>open</button>
      <button onClick={() => setTick(t => t + 1)}>rerender</button>
      {open && (
        // a fresh onClose on every render, exactly like `onClose={() => setOpen(false)}` in the buttons
        <Dialog title="Demo" onClose={() => { onClose?.(); setOpen(false) }}>
          <input aria-label="first field" />
          <input aria-label="second field" />
          <button onClick={() => setTick(t => t + 1)}>rerender inside</button>
        </Dialog>
      )}
    </>
  )
}

describe('Dialog', () => {
  it('is a labelled modal dialog that moves focus inside on open', async () => {
    const user = userEvent.setup()
    render(<Opener />)
    await user.click(screen.getByRole('button', { name: 'open' }))
    const dialog = screen.getByRole('dialog', { name: 'Demo' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog.contains(document.activeElement)).toBe(true)
  })

  it('does not steal focus back when the parent re-renders with a new onClose', async () => {
    const user = userEvent.setup()
    render(<Opener />)
    await user.click(screen.getByRole('button', { name: 'open' }))
    const second = screen.getByRole('textbox', { name: 'second field' })
    await user.click(second)
    act(() => { screen.getByRole('button', { name: 'rerender inside' }).click() })
    expect(document.activeElement).toBe(second)
  })

  it('closes on Escape and returns focus to the opener', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<Opener onClose={onClose} />)
    const opener = screen.getByRole('button', { name: 'open' })
    await user.click(opener)
    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(opener)
  })

  it('ignores an Escape that a control inside already handled', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(
      <Dialog title="Demo" onClose={onClose}>
        <input aria-label="field" onKeyDown={e => { if (e.key === 'Escape') e.preventDefault() }} />
      </Dialog>
    )
    await user.click(screen.getByRole('textbox', { name: 'field' }))
    await user.keyboard('{Escape}')
    expect(onClose).not.toHaveBeenCalled()
  })

  it('renders into document.body, so a transformed or backdrop-filtered ancestor cannot clip the fixed overlay', () => {
    render(
      <div data-testid="host" style={{ transform: 'translateZ(0)' }}>
        <Dialog title="Demo" onClose={() => {}}><input aria-label="field" /></Dialog>
      </div>
    )
    const dialog = screen.getByRole('dialog', { name: 'Demo' })
    expect(screen.getByTestId('host').contains(dialog)).toBe(false)
    expect(document.body.contains(dialog)).toBe(true)
  })

  it('returns focus to `returnFocus` when whatever had focus on open is gone by the time it closes', async () => {
    function EventOpened() {
      const [open, setOpen] = useState(true)
      const fallback = React.useRef<HTMLButtonElement>(null)
      return (
        <>
          <button ref={fallback}>owner</button>
          {open && <Dialog title="Demo" onClose={() => setOpen(false)} returnFocus={fallback}><input aria-label="field" /></Dialog>}
        </>
      )
    }
    // opened from somewhere that no longer exists (a command palette that closed itself)
    const transient = document.createElement('button')
    document.body.appendChild(transient)
    transient.focus()
    const user = userEvent.setup()
    render(<EventOpened />)
    transient.remove()
    await user.keyboard('{Escape}')
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'owner' }))
  })

  it('traps Tab inside the dialog', async () => {
    const user = userEvent.setup()
    render(<Opener />)
    await user.click(screen.getByRole('button', { name: 'open' }))
    const dialog = screen.getByRole('dialog')
    for (let i = 0; i < 6; i++) {
      await user.tab()
      expect(dialog.contains(document.activeElement)).toBe(true)
    }
    for (let i = 0; i < 6; i++) {
      await user.tab({ shift: true })
      expect(dialog.contains(document.activeElement)).toBe(true)
    }
  })
})
