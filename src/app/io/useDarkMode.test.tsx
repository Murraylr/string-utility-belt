import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { useDarkMode } from './useDarkMode'

describe('useDarkMode', () => {
  afterEach(() => {
    document.documentElement.classList.remove('dark')
  })

  it('reflects the initial class on <html>', () => {
    document.documentElement.classList.add('dark')
    const { result } = renderHook(() => useDarkMode())
    expect(result.current).toBe(true)
  })

  it('is false when the class is absent', () => {
    const { result } = renderHook(() => useDarkMode())
    expect(result.current).toBe(false)
  })

  it('updates when the class is toggled after mount', async () => {
    const { result } = renderHook(() => useDarkMode())
    expect(result.current).toBe(false)
    act(() => { document.documentElement.classList.add('dark') })
    await waitFor(() => expect(result.current).toBe(true))
  })
})
