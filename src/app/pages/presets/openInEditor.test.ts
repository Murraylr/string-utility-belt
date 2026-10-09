import { afterEach, describe, expect, it, vi } from 'vitest'
import type { PipelineStep } from '@/types/utility'
import { loadState, saveState } from '@/lib/persist'
import { listEntries } from '@/app/library/storage'
import * as autosave from '@/app/library/autosave'
import { openPipelineInEditor } from './openInEditor'

const presetSteps: PipelineStep[] = [
  { id: 'a', utilityId: 'trim', enabled: true, params: {} },
  { id: 'b', utilityId: 'case', enabled: true, params: { mode: 'upper' } },
]
const mine: PipelineStep[] = [{ id: 'm', utilityId: 'reverse', enabled: true, params: {} }]

afterEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  history.replaceState(null, '', '/')
  vi.restoreAllMocks()
})

describe('openPipelineInEditor', () => {
  it('saves the old pipeline to the library, makes the preset the working pipeline and opens the editor with the input', () => {
    saveState({ steps: mine, showPreviews: false })
    history.replaceState(null, '', '/presets/demo/')
    expect(openPipelineInEditor({ steps: presetSteps, input: 'hello', name: 'Demo preset' })).toBe('opened')

    const saved = loadState()
    expect(saved.name).toBe('Demo preset')
    expect(saved.showPreviews).toBe(true)
    expect(saved.steps.map(s => ('utilityId' in s ? s.utilityId : s.type))).toEqual(['trim', 'case'])
    // fresh ids: opening the same preset twice never collides
    expect(saved.steps.map(s => s.id)).not.toEqual(['a', 'b'])
    expect(listEntries('pipeline').some(e => e.steps.length === 1 && 'utilityId' in e.steps[0] && e.steps[0].utilityId === 'reverse')).toBe(true)
    expect(sessionStorage.getItem('sub:handoff-input')).toBe('hello')
    expect(location.pathname).toBe('/')
  })

  it('keeps the pipeline already there when it cannot be saved and the visitor says no', () => {
    saveState({ steps: mine, showPreviews: false })
    vi.spyOn(autosave, 'autosavePreviousPipeline').mockImplementation(() => { throw new Error('quota') })
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    history.replaceState(null, '', '/presets/demo/')

    expect(openPipelineInEditor({ steps: presetSteps, input: 'hello', name: 'Demo preset' })).toBe('kept')
    expect(confirm).toHaveBeenCalledOnce()
    expect(loadState().steps.map(s => s.id)).toEqual(['m'])
    expect(location.pathname).toBe('/presets/demo/')
  })

  it('replaces it anyway when the visitor agrees', () => {
    saveState({ steps: mine, showPreviews: false })
    vi.spyOn(autosave, 'autosavePreviousPipeline').mockImplementation(() => { throw new Error('quota') })
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    expect(openPipelineInEditor({ steps: presetSteps, input: '', name: 'Demo preset' })).toBe('opened')
    expect(loadState().steps).toHaveLength(2)
    expect(sessionStorage.getItem('sub:handoff-input')).toBeNull()
  })

  it('reports failure, and stays put, when storage refuses the preset (the editor would open without it)', () => {
    saveState({ steps: mine, showPreviews: false })
    history.replaceState(null, '', '/presets/demo/')
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('full', 'QuotaExceededError') })
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    expect(openPipelineInEditor({ steps: presetSteps, input: 'hello', name: 'Demo preset' })).toBe('failed')
    expect(location.pathname).toBe('/presets/demo/')
    expect(loadState().steps.map(s => s.id)).toEqual(['m'])
  })
})
