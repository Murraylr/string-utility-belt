import { describe, it, expect } from 'vitest'
import {
  childSequences, cloneWithNewIds, countSteps, findStep, isEachStep, mapChildSequences, someStep, stepTypeOf, updateStep,
  utilityIds, STEP_TYPES,
} from './steps'
import type { PipelineStep } from '../types/utility'

const u = (id: string, utilityId = 'trim'): PipelineStep => ({ id, utilityId, enabled: true, params: {} })
const each: PipelineStep = { id: 'e', type: 'each', enabled: true, split: { mode: 'lines' }, steps: [u('a'), u('b', 'upper')] }
const tree: PipelineStep[] = [
  u('top'),
  { id: 'br', type: 'branch', enabled: true, merge: { mode: 'concat' }, branches: [[each], [u('c')]] },
]

describe('step tree helpers', () => {
  it('know every step type', () => {
    expect(STEP_TYPES).toEqual(['utility', 'branch', 'macro', 'each'])
    expect(tree.map(stepTypeOf)).toEqual(['utility', 'branch'])
    expect(isEachStep(each)).toBe(true)
  })

  it('walk into each bodies', () => {
    expect(countSteps(tree)).toBe(6)
    expect(findStep(tree, 'b')).toEqual(u('b', 'upper'))
    expect(utilityIds(tree).sort()).toEqual(['trim', 'upper'])
    expect(someStep(tree, isEachStep)).toBe(true)
    expect(someStep([u('x')], isEachStep)).toBe(false)
  })

  it('report no children for a malformed container', () => {
    expect(childSequences({ id: 'x', type: 'each', split: { mode: 'lines' }, steps: 'nope' } as unknown as PipelineStep)).toEqual([])
    expect(childSequences({ id: 'y', type: 'branch', branches: [[u('a')], 'nope'] } as unknown as PipelineStep)).toEqual([[u('a')]])
  })

  it('mapChildSequences returns the same step when nothing changed', () => {
    expect(mapChildSequences(each, seq => seq)).toBe(each)
    expect(mapChildSequences(u('x'), () => [])).toEqual(u('x'))
    const next = mapChildSequences(each, seq => seq.slice(1)) as typeof each & { steps: PipelineStep[] }
    expect(next).not.toBe(each)
    expect(next.steps.map(s => s.id)).toEqual(['b'])
  })

  it('updateStep reaches inside an each nested in a branch, and keeps untouched subtrees by identity', () => {
    const next = updateStep(tree, 'b', s => ({ ...s, label: 'renamed' }))
    expect(findStep(next, 'b')?.label).toBe('renamed')
    expect(next[0]).toBe(tree[0])
    expect(updateStep(tree, 'missing', () => null)).toBe(tree)
    expect(countSteps(updateStep(tree, 'a', () => null))).toBe(5)
  })

  it('cloneWithNewIds gives an each step and its body fresh ids', () => {
    const copy = cloneWithNewIds(each) as typeof each & { steps: PipelineStep[] }
    expect(copy.id).not.toBe('e')
    expect(copy.steps.map(s => s.id)).not.toContain('a')
    expect(copy.steps).toHaveLength(2)
    expect((copy as any).split).toEqual({ mode: 'lines' })
  })
})
