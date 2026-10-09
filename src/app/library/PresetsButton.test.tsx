import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ToolProvider } from '@/app/ToolContext'
import PresetsButton from './PresetsButton'

const renderButton = () => render(<ToolProvider initialSteps={[]} initialInput=""><PresetsButton /></ToolProvider>)

describe('PresetsButton', () => {
  it('opens the gallery on click, and Escape closes it and returns focus to the button', async () => {
    const user = userEvent.setup()
    renderButton()
    const button = screen.getByRole('button', { name: 'Presets' })
    expect(button).toHaveAttribute('aria-haspopup', 'dialog')
    expect(screen.queryByRole('dialog')).toBeNull()

    await user.click(button)
    expect(await screen.findByRole('dialog', { name: 'Presets' })).toBeInTheDocument()

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(button)
  })

  it('also opens on the sub:open-presets window event', async () => {
    renderButton()
    act(() => { window.dispatchEvent(new CustomEvent('sub:open-presets')) })
    expect(await screen.findByRole('dialog', { name: 'Presets' })).toBeInTheDocument()
  })

  it('when opened by the sub:open-presets event, closing it puts focus on the button (not on <body>)', async () => {
    const user = userEvent.setup()
    renderButton()
    act(() => { window.dispatchEvent(new CustomEvent('sub:open-presets')) })
    await screen.findByRole('dialog', { name: 'Presets' })
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Presets' }))
  })

  it('shows a notice with a link to the presets page when the gallery cannot be fetched', async () => {
    vi.resetModules()
    vi.doMock('./PresetGallery', () => { throw new Error('Failed to fetch dynamically imported module') })
    try {
      const { default: Button } = await import('./PresetsButton')
      const user = userEvent.setup()
      render(<Button />)
      await user.click(screen.getByRole('button', { name: 'Presets' }))
      const dialog = await screen.findByRole('dialog', { name: 'Presets' })
      expect(dialog).toHaveTextContent('could not be loaded')
      expect(screen.getByRole('link', { name: 'browse the presets' })).toHaveAttribute('href', '/presets/')
    } finally {
      vi.doUnmock('./PresetGallery')
    }
  })
})
