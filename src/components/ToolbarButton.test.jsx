
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
})
