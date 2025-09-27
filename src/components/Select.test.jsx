
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import Select from './Select'

describe('Select', () => {
  it('renders options and changes value', () => {
    const onChange = vi.fn()
    render(<Select value={'a'} onChange={onChange} options={['a','b']} />)
    fireEvent.change(screen.getByRole('combobox'), { target:{ value:'b' } })
    expect(onChange).toHaveBeenCalledWith('b')
  })
})
