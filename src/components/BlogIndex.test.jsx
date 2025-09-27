import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import BlogIndex from './BlogIndex'

describe('<BlogIndex />', () => {
  it('renders Blog heading', () => {
    render(<BlogIndex />)
    expect(screen.getByText(/Blog/i)).toBeInTheDocument()
  })
})
