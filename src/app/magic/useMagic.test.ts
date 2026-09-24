import { describe, it, expect } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import type { Value } from '@/types/utility'
import { useMagic } from './useMagic'

describe('useMagic', () => {
  it('does no analysis while inactive', () => {
    const { result } = renderHook(() => useMagic(btoa('Hello, World!'), false))
    expect(result.current.loading).toBe(false)
    expect(result.current.suggestions).toEqual([])
    expect(result.current.error).toBeNull()
  })

  it('is not loading (and suggests nothing) for an empty value', () => {
    const { result } = renderHook(() => useMagic('', true))
    expect(result.current.loading).toBe(false)
    expect(result.current.suggestions).toEqual([])
  })

  it('reports loading from the very first render once active', () => {
    // otherwise the popover flashes "nothing obvious to decode" before analysis starts
    const { result } = renderHook(() => useMagic(btoa('Hello, World!'), true))
    expect(result.current.loading).toBe(true)
  })

  it('suggests base64 decode for base64 input once active', async () => {
    const value = btoa('Hello, World!')
    const { result } = renderHook(() => useMagic(value, true))
    await waitFor(() => expect(result.current.suggestions.length).toBeGreaterThan(0), { timeout: 10000 })
    expect(result.current.suggestions.some(s => s.step.utilityId === 'base64_decode')).toBe(true)
    expect(result.current.loading).toBe(false)
  }, 15000)

  it('never returns suggestions computed for a previous value', async () => {
    const { result, rerender } = renderHook(({ v }: { v: Value }) => useMagic(v, true), {
      initialProps: { v: btoa('Hello, World!') as Value },
    })
    await waitFor(() => expect(result.current.suggestions.length).toBeGreaterThan(0), { timeout: 10000 })

    rerender({ v: 'just some plain words' })
    // picking a stale "base64 decode" here would append a step for the old value
    expect(result.current.suggestions).toEqual([])
    expect(result.current.loading).toBe(true)
    await waitFor(() => expect(result.current.loading).toBe(false), { timeout: 10000 })
    expect(result.current.suggestions).toEqual([])
  }, 20000)

  it('decodeAll runs the full auto-decode chain', async () => {
    const value = btoa('Hello, World!')
    const { result } = renderHook(() => useMagic(value, false))
    const out = await result.current.decodeAll()
    expect(out.steps.map(s => s.utilityId)).toEqual(['base64_decode'])
    expect(out.value).toBe('Hello, World!')
  }, 15000)
})
