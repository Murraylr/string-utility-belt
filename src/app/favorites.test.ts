import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useFavorites, useRecents, useRecentCommands, pushRecent, pushRecentCommand, MAX_RECENTS } from './favorites'

beforeEach(() => localStorage.clear())

describe('useFavorites', () => {
  it('toggles and persists membership', () => {
    const { result, rerender } = renderHook(() => useFavorites())
    expect(result.current.isFavorite('trim')).toBe(false)
    act(() => result.current.toggleFavorite('trim'))
    rerender()
    expect(result.current.isFavorite('trim')).toBe(true)
    expect(result.current.favorites).toEqual(['trim'])
    act(() => result.current.toggleFavorite('trim'))
    rerender()
    expect(result.current.isFavorite('trim')).toBe(false)
  })

  it('survives a fresh hook instance (backed by localStorage)', () => {
    const a = renderHook(() => useFavorites())
    act(() => a.result.current.toggleFavorite('case'))
    const b = renderHook(() => useFavorites())
    expect(b.result.current.isFavorite('case')).toBe(true)
  })
})

describe('pushRecent / useRecents', () => {
  it('adds the most recent id to the front', () => {
    pushRecent('a')
    pushRecent('b')
    const { result } = renderHook(() => useRecents())
    expect(result.current.recents).toEqual(['b', 'a'])
  })

  it('dedupes: re-picking an id moves it to the front instead of duplicating', () => {
    pushRecent('a')
    pushRecent('b')
    pushRecent('a')
    const { result } = renderHook(() => useRecents())
    expect(result.current.recents).toEqual(['a', 'b'])
  })

  it('keeps recent commands in their own list, so palette commands never evict utility picks', () => {
    pushRecent('trim')
    for (let i = 0; i < MAX_RECENTS + 2; i++) pushRecentCommand(`cmd${i}`)
    const { result } = renderHook(() => ({ ...useRecents(), ...useRecentCommands() }))
    expect(result.current.recents).toEqual(['trim'])
    expect(result.current.recentCommands[0]).toBe(`cmd${MAX_RECENTS + 1}`)
    expect(result.current.recentCommands).toHaveLength(MAX_RECENTS)
  })

  it('tolerates corrupted stored lists instead of crashing', () => {
    localStorage.setItem('sub:pref:recents', '"not a list"')
    localStorage.setItem('sub:pref:favorites', '{"a":1}')
    localStorage.setItem('sub:pref:recentCommands', '[1, null, "undo"]')
    expect(() => pushRecent('trim')).not.toThrow()
    expect(JSON.parse(localStorage.getItem('sub:pref:recents')!)).toEqual(['trim'])
    const { result } = renderHook(() => ({ ...useFavorites(), ...useRecentCommands() }))
    expect(result.current.favorites).toEqual([])
    expect(result.current.isFavorite('a')).toBe(false)
    expect(result.current.recentCommands).toEqual(['undo'])
    act(() => result.current.toggleFavorite('case'))
    expect(JSON.parse(localStorage.getItem('sub:pref:favorites')!)).toEqual(['case'])
  })

  it('caps the list at MAX_RECENTS', () => {
    for (let i = 0; i < MAX_RECENTS + 5; i++) pushRecent(`id${i}`)
    const { result } = renderHook(() => useRecents())
    expect(result.current.recents).toHaveLength(MAX_RECENTS)
    expect(result.current.recents[0]).toBe(`id${MAX_RECENTS + 4}`)
  })
})
