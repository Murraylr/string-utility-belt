import { beforeEach, describe, expect, it } from 'vitest'
import { autosavePreviousPipeline, sameSteps } from './autosave'
import { listEntries } from './storage'

const step = (id: string, utilityId = 'trim') => ({ id, utilityId, enabled: true, params: {} })
/** A pipeline that genuinely differs from `[step(...)]` (ids alone do not make pipelines differ). */
const other = (id: string) => [step(id, 'upper'), step(`${id}2`, 'lower')]

beforeEach(() => {
  localStorage.clear()
})

describe('autosavePreviousPipeline', () => {
  it('does nothing when there is no previous pipeline', () => {
    const entry = autosavePreviousPipeline([], other('a'))
    expect(entry).toBeNull()
    expect(listEntries('pipeline')).toHaveLength(0)
  })

  it('does nothing when the previous pipeline is identical to the incoming one', () => {
    const entry = autosavePreviousPipeline([step('a')], [step('a')])
    expect(entry).toBeNull()
    expect(listEntries('pipeline')).toHaveLength(0)
  })

  it('saves a distinct previous pipeline as a named autosave', () => {
    const entry = autosavePreviousPipeline([step('a'), step('b')], other('c'))
    expect(entry).not.toBeNull()
    expect(entry!.name).toMatch(/^Autosave — /)
    expect(listEntries('pipeline')).toHaveLength(1)
  })

  it('never creates a second autosave for identical steps', () => {
    autosavePreviousPipeline([step('a')], other('c'))
    const second = autosavePreviousPipeline([step('a')], other('d'))
    expect(second).toBeNull()
    expect(listEntries('pipeline')).toHaveLength(1)
  })
})

describe('sameSteps', () => {
  it('ignores step ids, key order, an implicit enabled flag and undefined params', () => {
    const a = [{ id: 'x1', utilityId: 'trim', params: { mode: 'both', extra: undefined } }] as any
    const b = [{ params: { mode: 'both' }, enabled: true, utilityId: 'trim', id: 'other' }] as any
    expect(sameSteps(a, b)).toBe(true)
  })

  it('still tells different params, order and nesting apart', () => {
    expect(sameSteps([{ ...step('a'), params: { n: 1 } }], [{ ...step('a'), params: { n: 2 } }])).toBe(false)
    expect(sameSteps([step('a'), { ...step('b'), utilityId: 'upper' }], [{ ...step('b'), utilityId: 'upper' }, step('a')])).toBe(false)
    expect(sameSteps([{ ...step('a'), enabled: false }], [step('a')])).toBe(false)
    const lane = (u: string) => [{ id: 'b', type: 'branch', enabled: true, branches: [[step('x', u)]], merge: { mode: 'concat', separator: '\n' } }] as any
    expect(sameSteps(lane('trim'), lane('trim'))).toBe(true)
    expect(sameSteps(lane('trim'), lane('upper'))).toBe(false)
  })
})

describe('autosavePreviousPipeline dedupe', () => {
  it('treats a re-minted copy of an already saved pipeline as identical', () => {
    autosavePreviousPipeline([step('a')], other('c'))
    const second = autosavePreviousPipeline([step('a-fresh-id')], other('d'))
    expect(second).toBeNull()
    expect(listEntries('pipeline')).toHaveLength(1)
  })
})
