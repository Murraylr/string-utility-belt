import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ErrorPolicySelect from './ErrorPolicySelect'

vi.setConfig({ testTimeout: 20000 })

describe('<ErrorPolicySelect />', () => {
  it('defaults to passthrough when value is unset', () => {
    render(<ErrorPolicySelect onChange={() => {}} />)
    expect(screen.getByLabelText('on error').value).toBe('passthrough')
  })

  it('reports stop and empty as their own values', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<ErrorPolicySelect value="stop" onChange={onChange} />)
    await user.selectOptions(screen.getByLabelText('on error'), 'empty')
    expect(onChange).toHaveBeenCalledWith('empty')
  })

  it('normalises passthrough back to undefined (the default)', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<ErrorPolicySelect value="stop" onChange={onChange} />)
    await user.selectOptions(screen.getByLabelText('on error'), 'passthrough')
    expect(onChange).toHaveBeenCalledWith(undefined)
  })
})
