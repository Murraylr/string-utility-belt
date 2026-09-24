import { describe, expect, it } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ToolProvider } from '@/app/ToolContext'
import PresetsButton from './PresetsButton'

const renderButton = () => render(<ToolProvider initialSteps={[]} initialInput=""><PresetsButton /></ToolProvider>)

describe('PresetsButton', () => {
  it('opens the dialog on click, and Escape closes it and returns focus to the button', async () => {
    const user = userEvent.setup()
    renderButton()
    const button = screen.getByRole('button', { name: 'presets' })
    expect(button).toHaveAttribute('aria-haspopup', 'dialog')
    expect(screen.queryByRole('dialog')).toBeNull()

    await user.click(button)
    expect(screen.getByRole('dialog', { name: 'Preset gallery' })).toBeInTheDocument()

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(button)
  })

  it('also opens on the sub:open-presets window event', async () => {
    renderButton()
    act(() => { window.dispatchEvent(new CustomEvent('sub:open-presets')) })
    expect(await screen.findByRole('dialog', { name: 'Preset gallery' })).toBeInTheDocument()
  })

  it('when opened by the sub:open-presets event, closing it puts focus on the button (not on <body>)', async () => {
    const user = userEvent.setup()
    renderButton()
    act(() => { window.dispatchEvent(new CustomEvent('sub:open-presets')) })
    await screen.findByRole('dialog', { name: 'Preset gallery' })
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'presets' }))
  })
})
