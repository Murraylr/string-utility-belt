import { describe, expect, it } from 'vitest'
import { quarantineUntrusted, untrustedCodeSteps, CODE_UTILITIES } from './trust'
import { decodeShare, encodeShare, migratePipeline } from '@/core/serialize'
import { findStep } from '@/core/steps'
import type { PipelineDoc, PipelineStep } from '@/types/utility'

const js = (id: string, enabled = true): PipelineStep =>
  ({ id, utilityId: 'custom_js', enabled, params: { code: 'return input' } })
const util = (id: string, utilityId = 'trim'): PipelineStep => ({ id, utilityId, enabled: true, params: {} })

/** custom_js at the top level, inside a branch lane, inside a macro, and in a macro inside a lane. */
const hostile: PipelineDoc = {
  v: 2,
  name: 'looks harmless',
  steps: [
    util('a'),
    js('top'),
    {
      id: 'br', type: 'branch', enabled: true, merge: { mode: 'concat' },
      branches: [
        [util('b1'), js('inLane')],
        [{ id: 'm2', type: 'macro', name: 'nested', enabled: true, steps: [js('inLaneMacro'), util('b2')] }],
      ],
    },
    { id: 'm', type: 'macro', name: 'helper', enabled: true, steps: [util('m1', 'base64_encode'), js('inMacro')] },
  ],
}
const CODE_IDS = ['top', 'inLane', 'inLaneMacro', 'inMacro']
const OTHER_IDS = ['a', 'br', 'b1', 'm2', 'b2', 'm', 'm1']

const enabledOf = (steps: PipelineStep[], id: string) => findStep(steps, id)?.enabled

describe('untrusted pipelines', () => {
  it('treats custom_js as the code-running utility', () => {
    expect(CODE_UTILITIES.has('custom_js')).toBe(true)
  })

  it('finds custom code at every nesting level', () => {
    expect(untrustedCodeSteps(hostile.steps).sort()).toEqual([...CODE_IDS].sort())
  })

  it('a share link arrives with every custom code step disabled — and nothing else touched', () => {
    const doc = decodeShare(encodeShare(hostile))
    // before quarantine the decoded doc really is armed
    for (const id of CODE_IDS) expect(enabledOf(doc.steps, id)).toBe(true)
    const { steps, quarantined } = quarantineUntrusted(doc.steps)
    expect(quarantined.sort()).toEqual([...CODE_IDS].sort())
    for (const id of CODE_IDS) expect(enabledOf(steps, id)).toBe(false)
    for (const id of OTHER_IDS) expect(enabledOf(steps, id)).toBe(true)
    // code and params survive, so the user can review and enable it
    expect((findStep(steps, 'inMacro') as any).params.code).toBe('return input')
  })

  it('an imported pipeline file arrives disabled too', () => {
    const file = JSON.stringify(hostile)
    const doc = migratePipeline(JSON.parse(file))
    const { steps } = quarantineUntrusted(doc.steps)
    for (const id of CODE_IDS) expect(enabledOf(steps, id)).toBe(false)
  })

  it('an imported bare step array (older export format) arrives disabled', () => {
    const doc = migratePipeline(JSON.parse(JSON.stringify(hostile.steps)))
    const { steps } = quarantineUntrusted(doc.steps)
    for (const id of CODE_IDS) expect(enabledOf(steps, id)).toBe(false)
  })

  it('does not mutate what it was given', () => {
    const doc = decodeShare(encodeShare(hostile))
    const before = JSON.stringify(doc.steps)
    quarantineUntrusted(doc.steps)
    expect(JSON.stringify(doc.steps)).toBe(before)
  })

  it('is idempotent and leaves already-disabled steps disabled', () => {
    const once = quarantineUntrusted([js('x', false), util('y')])
    expect(once.steps[0].enabled).toBe(false)
    const twice = quarantineUntrusted(once.steps)
    expect(twice.steps).toEqual(once.steps)
  })

  it('disables nested code even when a container shares an id with a code step (unsanitized input)', () => {
    // ids are only unique after sanitizeSteps; quarantine must not rely on that
    const steps: PipelineStep[] = [
      js('dup'),
      { id: 'dup', type: 'macro', name: 'm', enabled: true, steps: [js('inner')] },
      { id: 'dup', type: 'branch', enabled: true, merge: { mode: 'concat' }, branches: [[js('lane')]] },
    ]
    const out = quarantineUntrusted(steps).steps as any[]
    expect(out[0].enabled).toBe(false)
    expect(out[1].steps[0].enabled).toBe(false)
    expect(out[2].branches[0][0].enabled).toBe(false)
    // a container is never disabled just because its id collides with a code step's
    expect(out[1].enabled).toBe(true)
    expect(out[2].enabled).toBe(true)
  })

  it('quarantines custom code inside "run on each" bodies arriving by share link, nested ones too', () => {
    const doc: PipelineDoc = {
      v: 3,
      steps: [
        { id: 'e', type: 'each', enabled: true, split: { mode: 'lines' }, steps: [util('e1'), js('inEach')] },
        {
          id: 'br', type: 'branch', enabled: true, merge: { mode: 'concat' },
          branches: [[{
            id: 'm', type: 'macro', name: 'm', enabled: true,
            steps: [{ id: 'e2', type: 'each', enabled: true, split: { mode: 'json-values' }, steps: [{ id: 'e3', type: 'each', enabled: true, split: { mode: 'delimiter', separator: ',' }, steps: [js('deep')] }] }],
          }]],
        },
      ],
    }
    const decoded = decodeShare(encodeShare(doc))
    expect(enabledOf(decoded.steps, 'deep')).toBe(true)
    const { steps, quarantined } = quarantineUntrusted(decoded.steps)
    expect(quarantined.sort()).toEqual(['deep', 'inEach'])
    expect(enabledOf(steps, 'inEach')).toBe(false)
    expect(enabledOf(steps, 'deep')).toBe(false)
    for (const id of ['e', 'e1', 'br', 'm', 'e2', 'e3']) expect(enabledOf(steps, id)).toBe(true)
    // the split survives the rebuild
    expect((findStep(steps, 'e3') as any).split).toEqual({ mode: 'delimiter', separator: ',' })
  })

  it('returns the same array when there is no custom code', () => {
    const steps = [util('a'), util('b', 'base64_encode')]
    const r = quarantineUntrusted(steps)
    expect(r.steps).toBe(steps)
    expect(r.quarantined).toEqual([])
  })
})
