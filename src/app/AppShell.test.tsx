import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Header } from './AppShell'

describe('Header nav', () => {
  it('marks the link for the current route with aria-current="page"', () => {
    render(<Header current="utility" />)
    const nav = screen.getByRole('navigation', { name: 'main' })
    const current = nav.querySelectorAll('[aria-current="page"]')
    expect(current).toHaveLength(1)
    expect(current[0].getAttribute('href')).toBe('/#/utilities')
  })

  it('treats a shared pipeline as the tool page', () => {
    render(<Header current="pipeline" />)
    expect(screen.getByRole('navigation', { name: 'main' }).querySelector('[aria-current="page"]')?.getAttribute('href')).toBe('/#/')
  })

  it('marks nothing when no route is given', () => {
    render(<Header />)
    expect(screen.getByRole('navigation', { name: 'main' }).querySelector('[aria-current]')).toBeNull()
  })
})
