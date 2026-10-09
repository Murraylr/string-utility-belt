import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ToolProvider } from '@/app/ToolContext'
import RecipesButton from './RecipesButton'

const renderButton = () => render(<ToolProvider initialSteps={[]} initialInput=""><RecipesButton /></ToolProvider>)

describe('RecipesButton', () => {
  it('opens the gallery on click, and Escape closes it and returns focus to the button', async () => {
    const user = userEvent.setup()
    renderButton()
    const button = screen.getByRole('button', { name: 'Recipes' })
    expect(button).toHaveAttribute('aria-haspopup', 'dialog')
    expect(screen.queryByRole('dialog')).toBeNull()

    await user.click(button)
    expect(await screen.findByRole('dialog', { name: 'Recipes' })).toBeInTheDocument()

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(button)
  })

  it('also opens on the sub:open-recipes window event', async () => {
    renderButton()
    act(() => { window.dispatchEvent(new CustomEvent('sub:open-recipes')) })
    expect(await screen.findByRole('dialog', { name: 'Recipes' })).toBeInTheDocument()
  })

  it('when opened by the sub:open-recipes event, closing it puts focus on the button (not on <body>)', async () => {
    const user = userEvent.setup()
    renderButton()
    act(() => { window.dispatchEvent(new CustomEvent('sub:open-recipes')) })
    await screen.findByRole('dialog', { name: 'Recipes' })
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Recipes' }))
  })

  it('shows a notice with a link to the recipes page when the gallery cannot be fetched', async () => {
    vi.resetModules()
    vi.doMock('./RecipeGallery', () => { throw new Error('Failed to fetch dynamically imported module') })
    try {
      const { default: Button } = await import('./RecipesButton')
      const user = userEvent.setup()
      render(<Button />)
      await user.click(screen.getByRole('button', { name: 'Recipes' }))
      const dialog = await screen.findByRole('dialog', { name: 'Recipes' })
      expect(dialog).toHaveTextContent('could not be loaded')
      expect(screen.getByRole('link', { name: 'browse the recipes' })).toHaveAttribute('href', '/recipes/')
    } finally {
      vi.doUnmock('./RecipeGallery')
    }
  })
})
