
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Play } from 'lucide-react'
import ToolbarButton from './ToolbarButton'

describe('ToolbarButton', () => {
  it('fires onClick', () => {
    const onClick = vi.fn()
    render(<ToolbarButton icon={Play} label="go" onClick={onClick} />)
    fireEvent.click(screen.getByText('go'))
    expect(onClick).toHaveBeenCalled()
  })

  it('gets its accessible name from the visible label text, not the icon', () => {
    render(<ToolbarButton icon={Play} label="Run pipeline" onClick={() => {}} />)
    expect(screen.getByRole('button', { name: 'Run pipeline' })).toBeInTheDocument()
  })

  it('hides the decorative icon from assistive tech and is a non-submitting button', () => {
    const { container } = render(<ToolbarButton icon={Play} label="go" onClick={() => {}} />)
    expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
    expect(container.querySelector('button')?.getAttribute('type')).toBe('button')
  })

  it('uses the shared .btn token class so it stays theme-aware', () => {
    render(<ToolbarButton icon={Play} label="go" onClick={() => {}} />)
    expect(screen.getByRole('button').className).toContain('btn')
  })
})
