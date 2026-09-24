import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useShareTarget, __resetForTests } from './useShareTarget'

function setLocation(search: string, hash = '') {
  window.history.replaceState(null, '', `/${search}${hash}`)
}

describe('useShareTarget', () => {
  beforeEach(() => {
    __resetForTests()
    setLocation('')
  })

  it('returns undefined and touches nothing when no share params are present', () => {
    setLocation('?foo=bar')
    const { result } = renderHook(() => useShareTarget())
    expect(result.current).toBeUndefined()
    expect(window.location.search).toBe('?foo=bar')
  })

  it('prefers text over url and title', () => {
    setLocation('?title=T&url=U&text=hello+world')
    const { result } = renderHook(() => useShareTarget())
    expect(result.current).toBe('hello world')
  })

  it('falls back to url when text is absent', () => {
    setLocation('?title=T&url=https%3A%2F%2Fexample.com')
    const { result } = renderHook(() => useShareTarget())
    expect(result.current).toBe('https://example.com')
  })

  it('falls back to title when text and url are absent', () => {
    setLocation('?title=hello')
    const { result } = renderHook(() => useShareTarget())
    expect(result.current).toBe('hello')
  })

  it('strips only the share params, keeps other query params and the hash', () => {
    setLocation('?keep=1&text=hi', '#/p/abc')
    renderHook(() => useShareTarget())
    expect(window.location.search).toBe('?keep=1')
    expect(window.location.hash).toBe('#/p/abc')
  })

  it('drops the search entirely when only share params were present', () => {
    setLocation('?text=hi', '#/')
    renderHook(() => useShareTarget())
    expect(window.location.search).toBe('')
    expect(window.location.hash).toBe('#/')
  })

  it('skips empty share params (Android sends title= with no value) but still scrubs them', () => {
    setLocation('?title=&text=&url=https%3A%2F%2Fexample.com%2F%3Fq%3D1', '#/')
    const { result } = renderHook(() => useShareTarget())
    expect(result.current).toBe('https://example.com/?q=1')
    expect(window.location.search).toBe('')
    expect(window.location.hash).toBe('#/')
  })

  it('scrubs share params that are all empty, returning undefined', () => {
    setLocation('?text=&keep=1')
    const { result } = renderHook(() => useShareTarget())
    expect(result.current).toBeUndefined()
    expect(window.location.search).toBe('?keep=1')
  })

  it('keeps unicode, emoji and newlines intact', () => {
    const text = 'héllo 👋\nsecond line & more'
    setLocation(`?text=${encodeURIComponent(text)}`)
    const { result } = renderHook(() => useShareTarget())
    expect(result.current).toBe(text)
  })

  it('does not push a history entry (Back must not return to the share URL)', () => {
    setLocation('?text=hi')
    const before = window.history.length
    renderHook(() => useShareTarget())
    expect(window.history.length).toBe(before)
  })

  it('only consumes the URL once, even across multiple hook instances', () => {
    setLocation('?text=first')
    const a = renderHook(() => useShareTarget())
    expect(a.result.current).toBe('first')

    // simulate a second mount (e.g. StrictMode's double-invoked initializer,
    // or another component using the hook) without resetting module state
    const b = renderHook(() => useShareTarget())
    expect(b.result.current).toBe('first')
  })
})
