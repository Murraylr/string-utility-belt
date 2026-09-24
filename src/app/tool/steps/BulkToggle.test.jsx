import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const dispatch = vi.fn()
vi.mock('@/app/ToolContext', () => ({ useOptionalTool: () => ({ dispatch }) }))

const { default: BulkToggle } = await import('./BulkToggle')

vi.setConfig({ testTimeout: 20000 })

describe('<BulkToggle />', () => {
  it('dispatches SET_ALL_ENABLED for enable/disable all', async () => {
    const user = userEvent.setup()
    render(<BulkToggle />)
    await user.click(screen.getByRole('button', { name: 'Enable all' }))
    expect(dispatch).toHaveBeenCalledWith({ type: 'SET_ALL_ENABLED', enabled: true })
    await user.click(screen.getByRole('button', { name: 'Disable all' }))
    expect(dispatch).toHaveBeenCalledWith({ type: 'SET_ALL_ENABLED', enabled: false })
  })
})
