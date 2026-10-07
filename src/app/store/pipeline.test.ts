import { describe, it, expect } from 'vitest'
import { pipelineReducer as r, initialPipelineState, HISTORY_LIMIT, type PipelineState } from './pipeline'
import { findStep } from '@/core/steps'
import type { PipelineStep } from '@/types/utility'

const s = (id: string, utilityId = 'trim', extra: Partial<PipelineStep> = {}): PipelineStep =>
  ({ id, utilityId, enabled: true, params: {}, ...extra }) as PipelineStep
const ids = (st: PipelineState) => st.steps.map(x => x.id)
const start = (...steps: PipelineStep[]) => initialPipelineState(steps)

describe('pipelineReducer', () => {
  it('adds a step at the end, or after a given step', () => {
    let st = r(start(s('a'), s('b')), { type: 'ADD_STEP', utilityId: 'case', id: 'x' })
    expect(ids(st)).toEqual(['a', 'b', 'x'])
    st = r(st, { type: 'ADD_STEP', utilityId: 'case', id: 'y', target: { afterId: 'a' } })
    expect(ids(st)).toEqual(['a', 'y', 'b', 'x'])
  })

  it('adds into a branch lane and a macro body', () => {
    const br: PipelineStep = { id: 'br', type: 'branch', enabled: true, merge: { mode: 'concat' }, branches: [[], []] }
    const mc: PipelineStep = { id: 'mc', type: 'macro', name: 'm', enabled: true, steps: [] }
    let st = r(start(br, mc), { type: 'ADD_STEP', utilityId: 'trim', id: 'in1', target: { parentId: 'br', lane: 1 } })
    st = r(st, { type: 'ADD_STEP', utilityId: 'trim', id: 'in2', target: { parentId: 'mc' } })
    expect((st.steps[0] as any).branches[1].map((x: any) => x.id)).toEqual(['in1'])
    expect((st.steps[1] as any).steps.map((x: any) => x.id)).toEqual(['in2'])
  })

  it('inserts copies of steps with fresh ids', () => {
    const st = r(start(s('a')), { type: 'INSERT_STEPS', steps: [s('a'), s('b')] })
    expect(st.steps).toHaveLength(3)
    expect(new Set(ids(st)).size).toBe(3)
  })

  it('removes, moves and duplicates by id at any depth', () => {
    const mc: PipelineStep = { id: 'mc', type: 'macro', name: 'm', enabled: true, steps: [s('m1'), s('m2')] }
    let st = r(start(s('a'), mc), { type: 'MOVE_STEP', id: 'm2', direction: 'up' })
    expect((st.steps[1] as any).steps.map((x: any) => x.id)).toEqual(['m2', 'm1'])
    st = r(st, { type: 'MOVE_STEP', id: 'a', direction: 'up' })
    expect(ids(st)).toEqual(['a', 'mc'])
    st = r(st, { type: 'DUPLICATE_STEP', id: 'a' })
    expect(st.steps).toHaveLength(3)
    expect(st.steps[1].id).not.toBe('a')
    st = r(st, { type: 'REMOVE_STEP', id: 'm1' })
    expect(findStep(st.steps, 'm1')).toBeUndefined()
  })

  it('reorders one sequence only when given a permutation of its ids', () => {
    const base = start(s('a'), s('b'), s('c'))
    expect(ids(r(base, { type: 'REORDER', ids: ['c', 'a', 'b'] }))).toEqual(['c', 'a', 'b'])
    expect(r(base, { type: 'REORDER', ids: ['c', 'a'] })).toBe(base)
    expect(r(base, { type: 'REORDER', ids: ['a', 'b', 'c'] })).toBe(base)
  })

  it('toggles, solos and enables all', () => {
    let st = r(start(s('a'), s('b'), s('c')), { type: 'SOLO_STEP', id: 'b' })
    expect(st.steps.map(x => x.enabled)).toEqual([false, true, false])
    st = r(st, { type: 'SET_ALL_ENABLED', enabled: true })
    expect(st.steps.every(x => x.enabled)).toBe(true)
    st = r(st, { type: 'TOGGLE_STEP', id: 'c', enabled: false })
    expect(st.steps[2].enabled).toBe(false)
  })

  it('never bulk-enables a code-running step', () => {
    const code = s('c', 'custom_js', { enabled: false })
    const mc: PipelineStep = { id: 'mc', type: 'macro', name: 'm', enabled: false, steps: [s('inner', 'custom_js', { enabled: false })] }
    let st = r(start(s('a', 'trim', { enabled: false }), code, mc), { type: 'SET_ALL_ENABLED', enabled: true })
    expect(st.steps.map(x => x.enabled)).toEqual([true, false, true])
    expect((st.steps[2] as any).steps[0].enabled).toBe(false)
    // an explicit toggle still works, and disabling everything still includes code steps
    st = r(st, { type: 'TOGGLE_STEP', id: 'c', enabled: true })
    expect(st.steps[1].enabled).toBe(true)
    st = r(st, { type: 'SET_ALL_ENABLED', enabled: false })
    expect(st.steps.every(x => x.enabled === false)).toBe(true)
  })

  it('changes a step\'s utility and params', () => {
    let st = r(start(s('a')), { type: 'CHANGE_UTILITY', id: 'a', utilityId: 'truncate', params: { length: 20 } })
    expect(st.steps[0]).toMatchObject({ utilityId: 'truncate', params: { length: 20 } })
    st = r(st, { type: 'SET_PARAMS', id: 'a', params: { length: 5 }, at: 0 })
    expect((st.steps[0] as any).params).toEqual({ length: 5 })
  })

  it('patches step fields and deletes undefined ones', () => {
    let st = r(start(s('a')), { type: 'UPDATE_STEP', id: 'a', patch: { onError: 'stop', label: 'x' } })
    expect(st.steps[0]).toMatchObject({ onError: 'stop', label: 'x' })
    st = r(st, { type: 'UPDATE_STEP', id: 'a', patch: { label: undefined } })
    expect('label' in st.steps[0]).toBe(false)
  })

  it('adds and removes branch lanes (never below one)', () => {
    let st = r(start(), { type: 'ADD_BRANCH', lanes: 1 })
    const id = st.steps[0].id
    st = r(st, { type: 'ADD_LANE', id })
    expect((st.steps[0] as any).branches).toHaveLength(2)
    st = r(st, { type: 'REMOVE_LANE', id, lane: 0 })
    st = r(st, { type: 'REMOVE_LANE', id, lane: 0 })
    expect((st.steps[0] as any).branches).toHaveLength(1)
  })

  it('wraps a contiguous run into a macro and unwraps it', () => {
    let st = r(start(s('a'), s('b'), s('c')), { type: 'WRAP', ids: ['b', 'c'], as: 'macro', name: 'tail' })
    expect(st.steps).toHaveLength(2)
    expect(st.steps[1]).toMatchObject({ type: 'macro', name: 'tail' })
    st = r(st, { type: 'UNWRAP', id: st.steps[1].id })
    expect(ids(st)).toEqual(['a', 'b', 'c'])
  })

  describe('run on each', () => {
    const each = (steps: PipelineStep[] = [], id = 'ea'): PipelineStep =>
      ({ id, type: 'each', enabled: true, split: { mode: 'lines' }, skipEmpty: true, steps })

    it('adds an each step that splits on lines by default, or as given', () => {
      let st = r(start(s('a')), { type: 'ADD_EACH', id: 'e1' })
      expect(st.steps[1]).toEqual({ id: 'e1', type: 'each', enabled: true, split: { mode: 'lines' }, skipEmpty: true, steps: [] })
      st = r(st, { type: 'ADD_EACH', id: 'e2', split: { mode: 'json-values' }, target: { afterId: 'a' } })
      expect(ids(st)).toEqual(['a', 'e2', 'e1'])
      expect((st.steps[1] as any).split).toEqual({ mode: 'json-values' })
    })

    it('adds, moves, removes and reorders steps inside its body, and inside an each nested in a branch', () => {
      const br: PipelineStep = { id: 'br', type: 'branch', enabled: true, merge: { mode: 'concat' }, branches: [[], [each([s('n1')], 'inner')]] }
      let st = r(start(each([s('x'), s('y')]), br), { type: 'ADD_STEP', utilityId: 'case', id: 'z', target: { parentId: 'ea', afterId: 'x' } })
      expect((st.steps[0] as any).steps.map((x: any) => x.id)).toEqual(['x', 'z', 'y'])
      st = r(st, { type: 'MOVE_STEP', id: 'y', direction: 'up' })
      expect((st.steps[0] as any).steps.map((x: any) => x.id)).toEqual(['x', 'y', 'z'])
      st = r(st, { type: 'REORDER', ids: ['z', 'x', 'y'], parentId: 'ea' })
      expect((st.steps[0] as any).steps.map((x: any) => x.id)).toEqual(['z', 'x', 'y'])
      st = r(st, { type: 'REMOVE_STEP', id: 'x' })
      expect((st.steps[0] as any).steps.map((x: any) => x.id)).toEqual(['z', 'y'])
      st = r(st, { type: 'ADD_STEP', utilityId: 'trim', id: 'n2', target: { parentId: 'inner' } })
      expect((findStep(st.steps, 'inner') as any).steps.map((x: any) => x.id)).toEqual(['n1', 'n2'])
      st = r(st, { type: 'SET_PARAMS', id: 'n2', params: { mode: 'both' } })
      expect((findStep(st.steps, 'n2') as any).params).toEqual({ mode: 'both' })
    })

    it('patches the split and the empty-item rule as undoable edits', () => {
      let st = r(start(each([s('x')])), { type: 'UPDATE_STEP', id: 'ea', patch: { split: { mode: 'delimiter', separator: ',' } } })
      st = r(st, { type: 'UPDATE_STEP', id: 'ea', patch: { skipEmpty: false } })
      expect(st.steps[0]).toMatchObject({ split: { mode: 'delimiter', separator: ',' }, skipEmpty: false })
      st = r(st, { type: 'UNDO' })
      expect((st.steps[0] as any).skipEmpty).toBe(true)
      st = r(st, { type: 'UNDO' })
      expect((st.steps[0] as any).split).toEqual({ mode: 'lines' })
      st = r(st, { type: 'REDO' })
      expect((st.steps[0] as any).split).toEqual({ mode: 'delimiter', separator: ',' })
    })

    it('wraps a contiguous run into an each step, unwraps it, and undoes both', () => {
      let st = r(start(s('a'), s('b'), s('c')), { type: 'WRAP', ids: ['b', 'c'], as: 'each', split: { mode: 'json-array' } })
      expect(st.steps).toHaveLength(2)
      expect(st.steps[1]).toMatchObject({ type: 'each', split: { mode: 'json-array' }, skipEmpty: true })
      expect((st.steps[1] as any).steps.map((x: any) => x.id)).toEqual(['b', 'c'])
      const wrappedId = st.steps[1].id
      st = r(st, { type: 'UNWRAP', id: wrappedId })
      expect(ids(st)).toEqual(['a', 'b', 'c'])
      st = r(st, { type: 'UNDO' })
      expect(ids(st)).toEqual(['a', wrappedId])
      st = r(st, { type: 'UNDO' })
      expect(ids(st)).toEqual(['a', 'b', 'c'])
    })

    it('bulk-toggles steps inside an each body, still never enabling custom code', () => {
      const st = r(start(each([s('x', 'trim', { enabled: false }), s('js', 'custom_js', { enabled: false })])), { type: 'SET_ALL_ENABLED', enabled: true })
      expect(findStep(st.steps, 'x')?.enabled).toBe(true)
      expect(findStep(st.steps, 'js')?.enabled).toBe(false)
    })

    it('duplicates an each step with fresh ids throughout', () => {
      const st = r(start(each([s('x')])), { type: 'DUPLICATE_STEP', id: 'ea' })
      expect(st.steps).toHaveLength(2)
      expect(st.steps[1].id).not.toBe('ea')
      expect((st.steps[1] as any).steps[0].id).not.toBe('x')
      expect((st.steps[1] as any).split).toEqual({ mode: 'lines' })
    })
  })

  it('refuses to wrap a non-contiguous selection', () => {
    const base = start(s('a'), s('b'), s('c'))
    expect(r(base, { type: 'WRAP', ids: ['a', 'c'], as: 'macro' })).toBe(base)
  })

  describe('history', () => {
    it('undoes and redoes edits', () => {
      let st = r(start(s('a')), { type: 'ADD_STEP', utilityId: 'x', id: 'b' })
      st = r(st, { type: 'REMOVE_STEP', id: 'a' })
      st = r(st, { type: 'UNDO' })
      expect(ids(st)).toEqual(['a', 'b'])
      st = r(st, { type: 'UNDO' })
      expect(ids(st)).toEqual(['a'])
      st = r(st, { type: 'REDO' })
      expect(ids(st)).toEqual(['a', 'b'])
    })

    it('clears redo on a new edit and ignores no-op edits', () => {
      let st = r(start(s('a')), { type: 'REMOVE_STEP', id: 'a' })
      st = r(st, { type: 'UNDO' })
      expect(st.future).toHaveLength(1)
      st = r(st, { type: 'ADD_STEP', utilityId: 'x', id: 'b' })
      expect(st.future).toHaveLength(0)
      const same = r(st, { type: 'MOVE_STEP', id: 'a', direction: 'up' })
      expect(same).toBe(st)
    })

    it('coalesces rapid param edits of one step into one entry', () => {
      let st = r(start(s('a'), s('b')), { type: 'SET_PARAMS', id: 'a', params: { n: 1 }, at: 1000 })
      st = r(st, { type: 'SET_PARAMS', id: 'a', params: { n: 12 }, at: 1300 })
      st = r(st, { type: 'SET_PARAMS', id: 'a', params: { n: 123 }, at: 1600 })
      expect(st.past).toHaveLength(1)
      st = r(st, { type: 'SET_PARAMS', id: 'b', params: { n: 1 }, at: 1700 })
      st = r(st, { type: 'SET_PARAMS', id: 'a', params: { n: 9 }, at: 5000 })
      expect(st.past).toHaveLength(3)
      st = r(st, { type: 'UNDO' }); st = r(st, { type: 'UNDO' }); st = r(st, { type: 'UNDO' })
      expect((st.steps[0] as any).params).toEqual({})
    })

    it('caps history', () => {
      let st = start()
      for (let i = 0; i < HISTORY_LIMIT + 20; i++) st = r(st, { type: 'ADD_STEP', utilityId: 'x', id: `s${i}` })
      expect(st.past).toHaveLength(HISTORY_LIMIT)
    })

    it('makes LOAD and CLEAR undoable and tracks the pipeline name', () => {
      let st = r(start(s('a')), { type: 'LOAD', steps: [s('z')], name: 'Saved', libraryId: 'lib1' })
      expect(st).toMatchObject({ name: 'Saved', libraryId: 'lib1' })
      st = r(st, { type: 'CLEAR' })
      expect(st.steps).toEqual([])
      expect(st.name).toBeUndefined()
      st = r(st, { type: 'UNDO' })
      expect(ids(st)).toEqual(['z'])
    })
  })
})
