import { describe, it, expect, beforeEach } from 'vitest'
import { loadState, saveState } from './persist'

describe('persist', () => {
  beforeEach(() => {
    localStorage.clear()
  })
  it('saves and loads the pipeline config, not the input text', () => {
    const steps = [{ id: 's1', utilityId: 'trim', enabled: true, params: {} }]
    saveState({ input: 'x', steps, showPreviews: true })
    const got = loadState()
    expect(got.steps).toEqual(steps)
    expect(got.showPreviews).toBe(true)
    expect(got.input).toBeUndefined()
  })
})
