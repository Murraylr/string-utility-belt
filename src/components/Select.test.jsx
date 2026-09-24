
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

  it('labels an empty-string option with the translated placeholder', () => {
    render(<Select value={''} onChange={() => {}} options={['', 'a']} />)
    expect(screen.getByText('— select —')).toBeInTheDocument()
  })

  it('applies the shared .field token class so it stays theme-aware', () => {
    render(<Select value={'a'} onChange={() => {}} options={['a']} className="extra" />)
    const select = screen.getByRole('combobox')
    expect(select.className).toContain('field')
    expect(select.className).toContain('extra')
  })
})

describe('Select (review regressions)', () => {
  it('passes accessibility attributes through so callers can name it', () => {
    render(<Select value={''} onChange={() => {}} options={['', 'a']} aria-label="add a step" disabled />)
    const select = screen.getByRole('combobox', { name: 'add a step' })
    expect(select).toBeDisabled()
  })

  it('renders optgroups and object options', () => {
    const onChange = vi.fn()
    render(<Select value="x" onChange={onChange} options={[{ label: 'Group', options: [{ label: 'Ex', value: 'x' }, 'y'] }]} />)
    expect(screen.getByRole('group', { name: 'Group' })).toBeInTheDocument()
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'y' } })
    expect(onChange).toHaveBeenCalledWith('y')
  })
})

describe('Select width cap', () => {
  it('caps its width to the container by default (a long option list must not overflow the page)', () => {
    render(<Select value="a" onChange={() => {}} options={['a']} />)
    expect(screen.getByRole('combobox')).toHaveClass('min-w-0', 'max-w-full')
  })

  it("keeps a caller's own max-w-* instead of adding max-w-full, which would override it", () => {
    render(<Select value="a" onChange={() => {}} options={['a']} className="max-w-sm" />)
    const select = screen.getByRole('combobox')
    expect(select).toHaveClass('max-w-sm')
    expect(select).not.toHaveClass('max-w-full')
  })
})
