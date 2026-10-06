import { describe, expect, it, vi } from 'vitest'
import { MAX_FAVORITES, MAX_PIPELINE_CHARS, MAX_SAVED_PIPELINES } from '../../../../src/core/extensionBridge'
import { mergeFavorites, move, pipelineProblem, upsertPipeline } from './library'
import type { SavedPipeline } from './storage'

// Importing the registry transforms the generated utility manifest (slow on a cold cache).
vi.setConfig({ testTimeout: 30000 })

const trim = [{ id: 's', utilityId: 'trim', params: {} }]
let n = 0
const makeId = () => `id${++n}`

describe('upsertPipeline', () => {
  it('appends a new pipeline with a normalized name and sanitized steps', () => {
    const outcome = upsertPipeline([], '  Clean   up ', [{ utilityId: 'trim', junk: true }], 10, makeId)
    expect(outcome).toMatchObject({ ok: true, value: { replaced: false, saved: { name: 'Clean up', updatedAt: 10 } } })
    if (!outcome.ok) return
    expect(outcome.value.list).toEqual([outcome.value.saved])
    expect(outcome.value.saved.steps[0]).not.toHaveProperty('junk')
  })

  it('replaces a same-named pipeline (ignoring case) in place, keeping its id', () => {
    const list: SavedPipeline[] = [
      { id: 'a', name: 'First', steps: trim, updatedAt: 1 },
      { id: 'b', name: 'Second', steps: trim, updatedAt: 1 },
    ]
    const outcome = upsertPipeline(list, 'FIRST', [{ id: 'x', utilityId: 'sha3' }], 20, makeId)
    expect(outcome.ok && outcome.value.list.map(p => [p.id, p.name, (p.steps[0] as { utilityId: string }).utilityId])).toEqual([
      ['a', 'FIRST', 'sha3'], ['b', 'Second', 'trim'],
    ])
    expect(outcome.ok && outcome.value.replaced).toBe(true)
  })

  it('refuses a new pipeline past the limit, but still updates an existing one', () => {
    const full = Array.from({ length: MAX_SAVED_PIPELINES }, (_, i) => ({ id: `p${i}`, name: `P${i}`, steps: trim, updatedAt: 0 }))
    expect(upsertPipeline(full, 'one more', trim, 0, makeId)).toMatchObject({ ok: false, error: expect.stringMatching(/up to 50/) })
    expect(upsertPipeline(full, 'P3', trim, 0, makeId)).toMatchObject({ ok: true })
  })

  it('refuses a blank name and an empty pipeline', () => {
    expect(upsertPipeline([], ' ', trim, 0, makeId)).toEqual({ ok: false, error: 'Give the pipeline a name.' })
    expect(upsertPipeline([], 'x', 'not steps', 0, makeId)).toEqual({ ok: false, error: 'The pipeline has no steps.' })
  })
})

describe('pipelineProblem', () => {
  it('names the utilities the extension cannot run, once each', () => {
    expect(pipelineProblem([
      { id: 'a', utilityId: 'custom_js' }, { id: 'b', utilityId: 'custom_js' }, { id: 'c', utilityId: 'html_to_markdown' },
    ])).toMatch(/can't run custom javascript, html to markdown\. Remove those steps/)
  })

  it('refuses an oversized pipeline', () => {
    expect(pipelineProblem([{ id: 'a', utilityId: 'trim', params: { pad: 'x'.repeat(MAX_PIPELINE_CHARS) } }])).toMatch(/too large/)
  })

  it('accepts a runnable pipeline', () => {
    expect(pipelineProblem(trim)).toBeNull()
  })
})

describe('mergeFavorites', () => {
  it('appends new runnable ids in order, counting unavailable ones', () => {
    expect(mergeFavorites(['trim'], ['sha3', 'trim', 'sha3', 'custom_js', 'nope', 'case'])).toEqual({
      list: ['trim', 'sha3', 'case'], added: 2, unavailable: 2, overflow: 0,
    })
  })

  it('stops at the favourites limit and counts what did not fit', () => {
    const ids = ['trim', 'sha3', 'case', 'base64_encode']
    const nearlyFull = Array.from({ length: MAX_FAVORITES - 1 }, (_, i) => `u${i}`)
    const { list, added, overflow } = mergeFavorites(nearlyFull, ids)
    expect(list).toHaveLength(MAX_FAVORITES)
    expect([added, overflow]).toEqual([1, 3])
  })
})

describe('move', () => {
  it('swaps with the neighbour, and leaves the ends alone', () => {
    expect(move(['a', 'b', 'c'], 1, -1)).toEqual(['b', 'a', 'c'])
    expect(move(['a', 'b', 'c'], 1, 1)).toEqual(['a', 'c', 'b'])
    expect(move(['a', 'b'], 0, -1)).toEqual(['a', 'b'])
    expect(move(['a', 'b'], 1, 1)).toEqual(['a', 'b'])
  })
})
