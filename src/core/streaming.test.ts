import { describe, it, expect, vi } from 'vitest'
import { canChunk, runChunked } from './streaming'
import { runPipeline } from './runner'
import type { PipelineStep, Utility } from '../types/utility'

const streamableUpper: Utility = {
  id: 'upper', name: 'upper', category: 'Test', params: {},
  streamable: true,
  apply: (input: any) => String(input).toUpperCase(),
}
const streamableSuffix: Utility = {
  id: 'suffix', name: 'suffix', category: 'Test', params: {},
  streamable: true,
  // per-line, so it actually satisfies f(a+'\n'+b) === f(a)+'\n'+f(b)
  apply: (input: any) => String(input).split('\n').map(l => `${l}!`).join('\n'),
}
const nonStreamable: Utility = {
  id: 'sort_lines', name: 'sort lines', category: 'Test', params: {},
  apply: (input: any) => String(input).split('\n').sort().join('\n'),
}

const UTILS: Record<string, Utility> = { upper: streamableUpper, suffix: streamableSuffix, sort_lines: nonStreamable }
const lookup = (id: string) => (UTILS[id] ? { streamable: !!UTILS[id].streamable } : undefined)
const load = (id: string) => {
  const u = UTILS[id]
  if (!u) throw new Error(`unknown: ${id}`)
  return u
}

const step = (utilityId: string, extra: Partial<PipelineStep> = {}): PipelineStep =>
  ({ id: utilityId, utilityId, ...extra } as PipelineStep)

describe('canChunk', () => {
  it('is true for an all-streamable chain', () => {
    expect(canChunk([step('upper'), step('suffix')], lookup)).toBe(true)
  })

  it('is false when any enabled step is not streamable', () => {
    expect(canChunk([step('upper'), step('sort_lines')], lookup)).toBe(false)
  })

  it('ignores a disabled non-streamable step', () => {
    expect(canChunk([step('upper'), step('sort_lines', { enabled: false })], lookup)).toBe(true)
  })

  it('is false for an enabled branch, but a disabled branch is just skipped', () => {
    const branch = { id: 'b', type: 'branch', branches: [[step('upper')]], merge: { mode: 'concat' } } as PipelineStep
    expect(canChunk([branch], lookup)).toBe(false)
    expect(canChunk([{ ...branch, enabled: false }], lookup)).toBe(true)
  })

  it('is false for any content-dependent condition', () => {
    expect(canChunk([step('upper', { condition: { kind: 'nonEmpty' } })], lookup)).toBe(false)
    expect(canChunk([step('upper', { condition: { kind: 'regex', pattern: 'x' } })], lookup)).toBe(false)
    expect(canChunk([step('upper', { condition: { kind: 'type', type: 'string' } })], lookup)).toBe(false)
  })

  it('treats an "always" condition (either polarity) as no condition: it never depends on content', () => {
    expect(canChunk([step('upper', { condition: { kind: 'always' } })], lookup)).toBe(true)
    expect(canChunk([step('upper', { condition: { kind: 'always', negate: true } })], lookup)).toBe(true)
  })

  it('is false for a conditioned macro, even when its inner steps are streamable', () => {
    const macro = { id: 'm', type: 'macro', name: 'm', steps: [step('upper')], condition: { kind: 'nonEmpty' } } as PipelineStep
    expect(canChunk([macro], lookup)).toBe(false)
  })

  it('is false for a branch nested inside a macro', () => {
    const branch = { id: 'b', type: 'branch', branches: [[step('upper')]], merge: { mode: 'concat' } } as PipelineStep
    const macro = { id: 'm', type: 'macro', name: 'm', steps: [step('upper'), branch] } as PipelineStep
    expect(canChunk([macro], lookup)).toBe(false)
  })

  it('is true for an empty pipeline', () => {
    expect(canChunk([], lookup)).toBe(true)
  })

  it('recurses into macros, requiring every inner enabled step to be streamable', () => {
    const okMacro = { id: 'm', type: 'macro', name: 'm', steps: [step('upper'), step('suffix')] } as PipelineStep
    expect(canChunk([okMacro], lookup)).toBe(true)
    const badMacro = { id: 'm2', type: 'macro', name: 'm2', steps: [step('upper'), step('sort_lines')] } as PipelineStep
    expect(canChunk([badMacro], lookup)).toBe(false)
  })

  it('is false for an unknown utility id', () => {
    expect(canChunk([step('ghost')], lookup)).toBe(false)
  })
})

describe('runChunked', () => {
  const steps = [step('upper'), step('suffix')]

  it('matches a full (non-chunked) run on a small fixture', async () => {
    const input = ['alpha', 'beta', 'gamma'].join('\n')
    const chunked = await runChunked(input, steps, { load, chunkLines: 1 })
    const full = await runPipeline(input, steps, { load })
    expect(chunked.out).toEqual(full.out)
    expect(chunked.aborted).toBe(false)
    expect(chunked.halted).toBe(false)
  })

  it('matches a full run for a larger fixture, split across many chunks', async () => {
    const lines = Array.from({ length: 237 }, (_, i) => `line-${i}`)
    const input = lines.join('\n')
    const chunked = await runChunked(input, steps, { load, chunkLines: 10 })
    const full = await runPipeline(input, steps, { load })
    expect(chunked.out).toEqual(full.out)
  })

  it('sums per-step timings across chunks', async () => {
    // each clock read advances 1ms, so every step's apply measures exactly 1ms per chunk
    let now = 0
    const clock = () => now++
    const input = Array.from({ length: 20 }, (_, i) => `l${i}`).join('\n')
    const res = await runChunked(input, steps, { load, chunkLines: 5, clock })
    expect(res.timings).toEqual({ upper: 4, suffix: 4 })
  })

  it('treats a non-positive or non-numeric chunk size as one line per chunk, not an infinite loop', async () => {
    const input = ['a', 'b', 'c'].join('\n')
    for (const chunkLines of [0, -3, Number.NaN]) {
      const res = await runChunked(input, steps, { load, chunkLines })
      expect(res.out).toBe('A!\nB!\nC!')
    }
  })

  it('preserves empty lines, a trailing newline, and CRLF line endings', async () => {
    const input = 'a\r\n\n\nb\r\n'
    const chunked = await runChunked(input, steps, { load, chunkLines: 1 })
    const full = await runPipeline(input, steps, { load })
    expect(chunked.out).toBe(full.out)
  })

  it('handles an empty source as a single empty chunk', async () => {
    const res = await runChunked('', steps, { load })
    expect(res.out).toBe('!')
    expect(res.aborted).toBe(false)
  })

  it('reports aborted without running anything when the signal is already aborted', async () => {
    const ac = new AbortController()
    ac.abort()
    const apply = vi.fn((i: any) => i)
    const res = await runChunked('a\nb', [step('t')], {
      load: () => ({ id: 't', name: 't', category: 'Test', params: {}, streamable: true, apply }), signal: ac.signal,
    })
    expect(res.aborted).toBe(true)
    expect(apply).not.toHaveBeenCalled()
  })

  it('keeps the first error message per step across chunks', async () => {
    let call = 0
    const flaky: Utility = {
      id: 'flaky', name: 'flaky', category: 'Test', params: {}, streamable: true,
      apply: () => { call++; throw new Error(`boom ${call}`) },
    }
    const flakySteps = [step('flaky')]
    const flakyLoad = (id: string) => (id === 'flaky' ? flaky : load(id))
    const input = ['a', 'b', 'c'].join('\n')
    const res = await runChunked(input, flakySteps, { load: flakyLoad, chunkLines: 1 })
    expect(res.err.flaky).toBe('boom 1')
  })

  it('merges errors and timings for step ids that shadow Object.prototype keys (ids come from share links)', async () => {
    const failing: Utility = {
      id: 'failing', name: 'failing', category: 'Test', params: {}, streamable: true,
      apply: () => { throw new Error('nope') },
    }
    let now = 0
    const ids = ['constructor', 'toString', 'hasOwnProperty']
    const res = await runChunked('a\nb\nc', ids.map(id => ({ id, utilityId: 'failing' })), {
      load: () => failing, chunkLines: 1, clock: () => now++,
    })
    for (const id of ids) {
      expect(Object.prototype.hasOwnProperty.call(res.err, id)).toBe(true)
      expect(res.err[id]).toBe('nope')
      expect(typeof res.timings[id]).toBe('number')
      expect(res.timings[id]).toBe(3) // 1ms per chunk, 3 chunks
    }
  })

  it('stops early and reports aborted when the signal fires between chunks', async () => {
    const ac = new AbortController()
    let chunksRun = 0
    const counting: Utility = {
      id: 'counting', name: 'counting', category: 'Test', params: {}, streamable: true,
      apply: (input: any) => { chunksRun++; if (chunksRun === 2) ac.abort(); return input },
    }
    const countingLoad = (id: string) => (id === 'counting' ? counting : load(id))
    const input = Array.from({ length: 10 }, (_, i) => `l${i}`).join('\n')
    const res = await runChunked(input, [step('counting')], { load: countingLoad, signal: ac.signal, chunkLines: 1 })
    expect(res.aborted).toBe(true)
    // aborted after the 2nd chunk's apply ran; the loop notices before starting a 3rd
    expect(chunksRun).toBe(2)
  })

  it('yields a macrotask between chunks', async () => {
    const input = Array.from({ length: 3 }, (_, i) => `l${i}`).join('\n')
    const order: string[] = []
    const spy = vi.fn(() => { order.push('apply') })
    const tracked: Utility = { id: 't', name: 't', category: 'Test', params: {}, streamable: true, apply: (i: any) => { spy(); return i } }
    setTimeout(() => order.push('macrotask'), 0)
    await runChunked(input, [step('t')], { load: () => tracked, chunkLines: 1 })
    // the pending macrotask got its turn between the first and second chunk
    expect(order).toEqual(['apply', 'macrotask', 'apply', 'apply'])
  })
})
