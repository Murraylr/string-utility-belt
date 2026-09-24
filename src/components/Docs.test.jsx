import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import Docs from './Docs'
import { UTIL_DISPLAY } from '@/utilities'

describe('<Docs />', () => {
  it('renders the usage guide', () => {
    render(<Docs />)
    expect(screen.getByRole('heading', { name: /how to use string utility belt/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Build a pipeline' })).toBeInTheDocument()
  })

  it('lists every registered utility in the reference', () => {
    render(<Docs />)
    for (const u of UTIL_DISPLAY) expect(screen.getAllByText(u.name).length).toBeGreaterThan(0)
  })
})
