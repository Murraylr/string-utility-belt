import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useTheme, useIsDark } from './useTheme'

type Listener = (e: { matches: boolean }) => void

function mockMatchMedia(initialMatches: boolean) {
  const listeners = new Set<Listener>()
  let matches = initialMatches
  const mql = {
    get matches() { return matches },
    media: '(prefers-color-scheme: dark)',
    addEventListener: (_: string, fn: Listener) => listeners.add(fn),
    removeEventListener: (_: string, fn: Listener) => listeners.delete(fn),
    addListener: (fn: Listener) => listeners.add(fn),
    removeListener: (fn: Listener) => listeners.delete(fn),
    dispatchEvent: () => true,
  }
  window.matchMedia = vi.fn().mockReturnValue(mql) as unknown as typeof window.matchMedia
  return {
    setMatches(next: boolean) {
      matches = next
      listeners.forEach(fn => fn({ matches: next }))
    },
  }
}

function clearThemeColorMeta() {
  document.querySelectorAll('meta[name="theme-color"]').forEach(m => m.remove())
}

describe('useTheme', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.classList.remove('dark')
    clearThemeColorMeta()
  })

  it('defaults to system and resolves against matchMedia', () => {
    mockMatchMedia(true)
    const { result } = renderHook(() => useTheme())
    expect(result.current.theme).toBe('system')
    expect(result.current.resolved).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('cycles system -> light -> dark -> system and persists to the pref', () => {
    mockMatchMedia(false)
    const { result } = renderHook(() => useTheme())

    act(() => result.current.cycle())
    expect(result.current.theme).toBe('light')
    expect(document.documentElement.classList.contains('dark')).toBe(false)

    act(() => result.current.cycle())
    expect(result.current.theme).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)

    act(() => result.current.cycle())
    expect(result.current.theme).toBe('system')
    expect(JSON.parse(localStorage.getItem('sub:pref:theme')!)).toBe('system')
  })

  it('updates <meta name="theme-color"> with the resolved theme', () => {
    mockMatchMedia(false)
    const { result } = renderHook(() => useTheme())

    act(() => result.current.setTheme('dark'))
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe('#0b0f19')

    act(() => result.current.setTheme('light'))
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe('#f8fafc')
  })

  it('follows OS prefers-color-scheme changes while on system', () => {
    const media = mockMatchMedia(false)
    renderHook(() => useTheme())
    expect(document.documentElement.classList.contains('dark')).toBe(false)

    act(() => media.setMatches(true))
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('ignores OS changes once pinned to an explicit theme', () => {
    const media = mockMatchMedia(false)
    const { result } = renderHook(() => useTheme())

    act(() => result.current.setTheme('light'))
    act(() => media.setMatches(true))
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })
})

describe('useIsDark', () => {
  beforeEach(() => document.documentElement.classList.remove('dark'))

  it('reacts to the dark class being toggled by something else', async () => {
    const { result } = renderHook(() => useIsDark())
    expect(result.current).toBe(false)

    await act(async () => {
      document.documentElement.classList.add('dark')
      await Promise.resolve()
    })
    expect(result.current).toBe(true)

    await act(async () => {
      document.documentElement.classList.remove('dark')
      await Promise.resolve()
    })
    expect(result.current).toBe(false)
  })
})

describe('useTheme (review regressions)', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.classList.remove('dark')
    clearThemeColorMeta()
  })

  it('re-renders with an updated `resolved` when the OS scheme flips while on system', () => {
    const media = mockMatchMedia(false)
    const { result } = renderHook(() => useTheme())
    expect(result.current.resolved).toBe('light')
    act(() => media.setMatches(true))
    expect(result.current.resolved).toBe('dark')
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe('#0b0f19')
  })

  it('treats a corrupt stored pref as system instead of leaking it through', () => {
    mockMatchMedia(true)
    localStorage.setItem('sub:pref:theme', JSON.stringify('blue'))
    const { result } = renderHook(() => useTheme())
    expect(result.current.theme).toBe('system')
    expect(result.current.resolved).toBe('dark')
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe('#0b0f19')
    act(() => result.current.cycle())
    expect(result.current.theme).toBe('light')
  })

  it('stops listening to the OS scheme after unmount', () => {
    const media = mockMatchMedia(false)
    const { unmount } = renderHook(() => useTheme())
    unmount()
    act(() => media.setMatches(true))
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })
})
