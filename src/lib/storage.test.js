
import { describe, it, expect, beforeEach } from 'vitest'
import { loadState, saveState } from './storage'

describe('storage', () => {
  beforeEach(() => { localStorage.clear() })
  it('saves and loads', () => {
    const state = { foo: 'bar' }
    saveState(state)
    expect(loadState()).toEqual(state)
  })
  it('returns null when nothing saved', () => {
    expect(loadState()).toBeNull()
  })
})
