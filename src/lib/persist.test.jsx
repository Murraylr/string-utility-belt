import { describe, it, expect, beforeEach } from 'vitest'
import { loadState, saveState, CURRENT_KEY } from './persist'

describe('persist', () => {
  beforeEach(() => {
    localStorage.clear()
  })
  it('saves and loads state', () => {
    saveState({ input: 'x', steps: [], showPreviews: true })
    const got = loadState()
    expect(got.input).toBe('x')
    expect(got.showPreviews).toBe(true)
  })
  it('migrates from previous keys', () => {
    localStorage.setItem('string-workshop-state-v6', JSON.stringify({ input: 'old', steps: [], showPreviews: false }))
    const got = loadState()
    expect(got.input).toBe('old')
    const cur = JSON.parse(localStorage.getItem(CURRENT_KEY))
    expect(cur.input).toBe('old')
  })
})
