import { describe, it, expect, beforeEach } from 'vitest'
import { loadState, saveState } from './persist'

describe('persist', () => {
  beforeEach(() => {
    localStorage.clear()
  })
  it('saves and loads state', () => {
    const step = { id: 'x', utilityId: 'trim', enabled: true, params: {} }
    saveState({ steps: [step], showPreviews: true, name: 'mine', libraryId: 'lib1' })
    const got = loadState()
    expect(got.steps).toEqual([step])
    expect(got.showPreviews).toBe(true)
    expect(got.name).toBe('mine')
    expect(got.libraryId).toBe('lib1')
    expect(JSON.parse(localStorage.getItem('string-utility-belt')).v).toBe(2)
  })
  it('returns defaults when nothing saved', () => {
    const got = loadState()
    expect(got.steps).toEqual([])
    expect(got.showPreviews).toBe(true)
  })
  it('drops corrupt step entries that would crash the render', () => {
    localStorage.setItem('string-utility-belt', JSON.stringify({
      steps: [null, 'junk', 42, { noId: true }, { id: 's1', utilityId: 'trim', enabled: true, params: {} }],
      showPreviews: true,
    }))
    const got = loadState()
    expect(got.steps).toEqual([{ id: 's1', utilityId: 'trim', enabled: true, params: {} }])
  })
  it('migrates v1 state and keeps its showPreviews choice', () => {
    localStorage.setItem('string-utility-belt', JSON.stringify({
      steps: [{ id: 's1', utilityId: 'trim', enabled: true, params: {} }],
      showPreviews: false,
    }))
    const got = loadState()
    expect(got.showPreviews).toBe(false)
    expect(got.steps).toHaveLength(1)
  })
  it('survives unparseable storage', () => {
    localStorage.setItem('string-utility-belt', '{nope')
    expect(loadState()).toEqual({ steps: [], showPreviews: true })
  })
})
