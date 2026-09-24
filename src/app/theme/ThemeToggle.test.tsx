import React from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import ThemeToggle from './ThemeToggle'
import { TOGGLE_THEME_EVENT } from './useTheme'

function mockMatchMedia(matches = false) {
  window.matchMedia = vi.fn().mockReturnValue({
    matches,
    media: '(prefers-color-scheme: dark)',
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }) as unknown as typeof window.matchMedia
}

describe('<ThemeToggle />', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.classList.remove('dark')
    mockMatchMedia(false)
  })

  it('states the current and next mode in its accessible name, and cycles on click', () => {
    render(<ThemeToggle />)
    const btn = screen.getByRole('button')
    expect(btn.getAttribute('aria-label')).toMatch(/System/)
    expect(btn.getAttribute('aria-label')).toMatch(/Light/)

    fireEvent.click(btn)
    expect(btn.getAttribute('aria-label')).toMatch(/^Theme: Light\./)
    expect(JSON.parse(localStorage.getItem('sub:pref:theme')!)).toBe('light')
  })

  it('cycles when the global sub:toggle-theme event fires', () => {
    render(<ThemeToggle />)
    act(() => { window.dispatchEvent(new Event(TOGGLE_THEME_EVENT)) })
    expect(JSON.parse(localStorage.getItem('sub:pref:theme')!)).toBe('light')
  })
})

describe('<ThemeToggle /> (review regressions)', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.classList.remove('dark')
    mockMatchMedia(false)
  })

  it('renders (as system) instead of crashing when the stored pref is corrupt', () => {
    localStorage.setItem('sub:pref:theme', JSON.stringify(42))
    render(<ThemeToggle />)
    expect(screen.getByRole('button', { name: 'Theme: System. Click for Light.' })).toBeInTheDocument()
  })

  it('stops listening for sub:toggle-theme once unmounted', () => {
    const { unmount } = render(<ThemeToggle />)
    unmount()
    act(() => { window.dispatchEvent(new Event(TOGGLE_THEME_EVENT)) })
    expect(localStorage.getItem('sub:pref:theme')).toBeNull()
  })

  it('advances exactly one step per event even with two toggles mounted (e.g. desktop + mobile header)', () => {
    render(<><ThemeToggle /><ThemeToggle /></>)
    act(() => { window.dispatchEvent(new Event(TOGGLE_THEME_EVENT)) })
    expect(JSON.parse(localStorage.getItem('sub:pref:theme')!)).toBe('light')
    for (const btn of screen.getAllByRole('button')) {
      expect(btn).toHaveAccessibleName('Theme: Light. Click for Dark.')
    }
  })

  it('names the next mode correctly through a full cycle', () => {
    render(<ThemeToggle />)
    const btn = screen.getByRole('button')
    const names: string[] = []
    for (let i = 0; i < 3; i++) { names.push(btn.getAttribute('aria-label')!); fireEvent.click(btn) }
    expect(names).toEqual([
      'Theme: System. Click for Light.',
      'Theme: Light. Click for Dark.',
      'Theme: Dark. Click for System.',
    ])
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })
})
