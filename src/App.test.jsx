
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import App from './App.jsx'

describe('<App />', () => {
  it('renders heading', () => {
    render(<App />)
    const text = screen.getByText(/string pipeline workshop/i)
    expect(text).toBeInTheDocument()
  })
})
