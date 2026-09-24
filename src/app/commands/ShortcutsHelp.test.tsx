import React from 'react'
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ShortcutsHelp from './ShortcutsHelp'
import { commands, EVENT_OPEN_SHORTCUTS } from './commands'

describe('ShortcutsHelp', () => {
  it('is closed until the open-shortcuts event fires', () => {
    render(<ShortcutsHelp />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    fireEvent(window, new Event(EVENT_OPEN_SHORTCUTS))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText(/Ctrl\/Cmd\+K/)).toBeInTheDocument()
  })

  it('closes on Escape and returns focus to the opener', () => {
    render(<><button>opener</button><ShortcutsHelp /></>)
    const opener = screen.getByText('opener')
    opener.focus()
    fireEvent(window, new Event(EVENT_OPEN_SHORTCUTS))
    const dialog = screen.getByRole('dialog')
    fireEvent.keyDown(dialog, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(document.activeElement).toBe(opener)
  })

  it('lists every command that declares a shortcut', () => {
    render(<ShortcutsHelp />)
    fireEvent(window, new Event(EVENT_OPEN_SHORTCUTS))
    const dialog = screen.getByRole('dialog', { name: 'Keyboard shortcuts' })
    for (const c of commands.filter(c => c.shortcut)) {
      expect(dialog).toHaveTextContent(c.title)
      expect(dialog).toHaveTextContent(c.shortcut!)
    }
  })

  it('keeps focus inside and still closes on Escape after a click on the dialog body', () => {
    render(<><button>outside</button><ShortcutsHelp /></>)
    fireEvent(window, new Event(EVENT_OPEN_SHORTCUTS))
    const dialog = screen.getByRole('dialog')
    const close = screen.getByLabelText('close')
    expect(document.activeElement).toBe(close)
    fireEvent.keyDown(close, { key: 'Tab' })
    expect(document.activeElement).toBe(close)
    // clicking non-focusable text focuses the dialog itself (tabindex=-1), not <body>
    expect(dialog).toHaveAttribute('tabindex', '-1')
    dialog.focus()
    fireEvent.keyDown(dialog, { key: 'Tab' })
    expect(document.activeElement).toBe(close)
    dialog.focus()
    fireEvent.keyDown(dialog, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('a second open event while open keeps the original opener for focus return', () => {
    render(<><button>opener</button><ShortcutsHelp /></>)
    const opener = screen.getByText('opener')
    opener.focus()
    fireEvent(window, new Event(EVENT_OPEN_SHORTCUTS))
    fireEvent(window, new Event(EVENT_OPEN_SHORTCUTS))
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(document.activeElement).toBe(opener)
  })

  it('closes via the close button', () => {
    render(<ShortcutsHelp />)
    fireEvent(window, new Event(EVENT_OPEN_SHORTCUTS))
    fireEvent.click(screen.getByLabelText('close'))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
