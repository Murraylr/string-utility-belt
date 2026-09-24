import { describe, it, expect, vi } from 'vitest'
import { createRegistry, metaOf, unsupportedSteps, canRunInWorker } from './registry'
import { compatibility } from './coerce'
import { cloneWithNewIds, findStep, updateStep, utilityIds, countSteps } from './steps'
import type { PipelineStep, Utility } from '../types/utility'

const util = (id: string, extra: Partial<Utility> = {}): Utility =>
  ({ id, name: id, category: 'Test', description: 'd', params: {}, apply: x => x, ...extra })

const metas = [
  metaOf(util('plain')),
  metaOf(util('xml', { category: 'Data' }), ['dom']),
  metaOf(util('hashy'), ['wasm']),
  metaOf(util('custom', { env: ['eval', 'main'] })),
]

describe('registry', () => {
  it('lists, looks up and groups metadata', () => {
    const r = createRegistry(metas, id => util(id))
    expect(r.list()).toHaveLength(4)
    expect(r.get('xml')?.category).toBe('Data')
    expect(r.has('nope')).toBe(false)
    expect(r.categories()).toEqual(['Test', 'Data'])
    expect(r.byCategory('Data').map(m => m.id)).toEqual(['xml'])
    expect(r.byCategory('All')).toHaveLength(4)
  })

  it('loads once and caches', async () => {
    const loader = vi.fn((id: string) => util(id))
    const r = createRegistry(metas, loader)
    await r.load('plain'); await r.load('plain')
    expect(loader).toHaveBeenCalledTimes(1)
  })

  it('rejects unknown ids', async () => {
    const r = createRegistry(metas, id => util(id))
    await expect(r.load('nope')).rejects.toThrow('unknown utility: nope')
  })

  it('retries a load that failed (a dropped chunk request)', async () => {
    let fail = true
    const r = createRegistry(metas, id => { if (fail) throw new Error('network'); return util(id) })
    await expect(r.load('plain')).rejects.toThrow('network')
    fail = false
    await expect(r.load('plain')).resolves.toMatchObject({ id: 'plain' })
  })

  it('merges declared and detected env, deduplicated and sorted', () => {
    expect(metaOf(util('x', { env: ['main', 'dom'] }), ['dom', 'eval']).env).toEqual(['dom', 'eval', 'main'])
  })
})

describe('environment support', () => {
  const lookup = (id: string) => metas.find(m => m.id === id)
  const steps: PipelineStep[] = [
    { id: '1', utilityId: 'plain' },
    { id: '2', type: 'macro', name: 'm', steps: [{ id: '3', utilityId: 'xml' }] },
    { id: '4', utilityId: 'hashy' },
    { id: '5', utilityId: 'custom' },
    { id: '6', utilityId: 'ghost' },
  ]

  it('finds what the edge runtime cannot run, nested steps included', () => {
    expect(unsupportedSteps(steps, lookup, 'edge').map(u => u.stepId)).toEqual(['3', '4', '5', '6'])
  })

  it('lets Node run wasm and dom but not main-thread utilities', () => {
    expect(unsupportedSteps(steps, lookup, 'node').map(u => u.stepId)).toEqual(['5', '6'])
  })

  it('knows when a Web Worker can take the whole pipeline', () => {
    expect(canRunInWorker([{ id: '1', utilityId: 'plain' }, { id: '4', utilityId: 'hashy' }], lookup)).toBe(true)
    expect(canRunInWorker(steps.slice(0, 2), lookup)).toBe(false)
    expect(canRunInWorker([{ id: '6', utilityId: 'ghost' }], lookup)).toBe(false)
  })
})

describe('compatibility', () => {
  it('grades type pairings', () => {
    expect(compatibility(['string'], 'string').level).toBe('exact')
    expect(compatibility(['string'], ['string', 'bytes']).level).toBe('exact')
    expect(compatibility(['bytes'], 'string').level).toBe('lossy')
    expect(compatibility(['string'], 'json')).toEqual({ level: 'coerce', note: 'text must be valid JSON' })
    expect(compatibility(['json'], 'string').level).toBe('coerce')
  })
})

describe('step helpers', () => {
  const tree: PipelineStep[] = [
    { id: 'a', utilityId: 'plain', params: { x: [1] } },
    { id: 'b', type: 'branch', merge: { mode: 'concat' }, branches: [[{ id: 'c', utilityId: 'xml' }], [{ id: 'd', utilityId: 'plain' }]] },
  ]

  it('finds nested steps and lists utility ids', () => {
    expect(findStep(tree, 'd')).toMatchObject({ utilityId: 'plain' })
    expect(utilityIds(tree).sort()).toEqual(['plain', 'xml'])
    expect(countSteps(tree)).toBe(4)
  })

  it('updates, splices and removes by id without mutating', () => {
    const renamed = updateStep(tree, 'c', s => ({ ...s, label: 'hi' }))
    expect(findStep(renamed, 'c')?.label).toBe('hi')
    expect(findStep(tree, 'c')?.label).toBeUndefined()
    expect(updateStep(tree, 'zzz', s => s)).toBe(tree)
    const removed = updateStep(tree, 'd', () => null)
    expect(findStep(removed, 'd')).toBeUndefined()
    const spliced = updateStep(tree, 'a', s => [s, { id: 'a2', utilityId: 'plain' }])
    expect(spliced.map(s => s.id)).toEqual(['a', 'a2', 'b'])
  })

  it('clones with fresh ids at every level and no shared params', () => {
    const copy = cloneWithNewIds(tree[1]) as any
    expect(copy.id).not.toBe('b')
    expect(copy.branches[0][0].id).not.toBe('c')
    const a = cloneWithNewIds(tree[0]) as any
    a.params.x.push(2)
    expect((tree[0] as any).params.x).toEqual([1])
  })
})
