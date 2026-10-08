import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const dispatch = vi.fn()
let steps = []
vi.mock('@/app/ToolContext', () => ({ useOptionalTool: () => ({ dispatch, state: { steps } }) }))

const { default: BulkToggle } = await import('./BulkToggle')

vi.setConfig({ testTimeout: 20000 })

const step = (id, enabled = true) => ({ id, utilityId: 'trim', enabled, params: {} })

describe('<BulkToggle />', () => {
  it('turns every step off while all are on', async () => {
    const user = userEvent.setup()
    steps = [step('a'), step('b')]
    render(<BulkToggle />)
    await user.click(screen.getByRole('button', { name: 'Turn all off' }))
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'SET_ALL_ENABLED', enabled: false })
  })

  it('turns every step on when any step, nested ones included, is off', async () => {
    const user = userEvent.setup()
    steps = [step('a'), { id: 'm', type: 'macro', name: 'm', enabled: true, steps: [step('x', false)] }]
    render(<BulkToggle />)
    await user.click(screen.getByRole('button', { name: 'Turn all on' }))
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'SET_ALL_ENABLED', enabled: true })
  })

  it('is disabled with no steps', () => {
    steps = []
    render(<BulkToggle />)
    expect(screen.getByRole('button', { name: 'Turn all off' })).toBeDisabled()
  })
})
