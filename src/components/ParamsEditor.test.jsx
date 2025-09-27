
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ParamsEditor from './ParamsEditor'

describe('ParamsEditor', () => {
  it('renders string input and updates value', () => {
    const spec = { pattern: { kind:'string', label:'pattern', default:'' } }
    const onChange = vi.fn()
    render(<ParamsEditor spec={spec} params={{}} onChange={onChange} />)
    fireEvent.change(screen.getByRole('textbox'), { target:{ value:'abc' } })
    expect(onChange).toHaveBeenCalled()
  })
})
