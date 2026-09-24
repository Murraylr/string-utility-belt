import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import Docs from './Docs'

describe('<Docs />', () => {
  it('renders the usage guide', () => {
    render(<Docs />)
    expect(screen.getByRole('heading', { name: /how to use string utility belt/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Build a pipeline' })).toBeInTheDocument()
  })

  it('points to the utilities index for the reference', () => {
    render(<Docs />)
    expect(screen.getByRole('link', { name: /utilities index/i })).toHaveAttribute('href', '#/utilities')
  })
})
