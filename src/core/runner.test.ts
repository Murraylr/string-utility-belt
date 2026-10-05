import { describe, it, expect } from 'vitest'
import { runPipeline, evalCondition, mergeOutputs, MAX_VALUE_SIZE } from './runner'
import type { PipelineStep, Utility } from '../types/utility'

const u = (id: string, apply: Utility['apply'], extra: Partial<Utility> = {}): Utility =>
  ({ id, name: id, category: 'Test', params: {}, apply, ...extra })

const UTILS: Record<string, Utility> = {
  upper: u('upper', x => String(x).toUpperCase()),
  exclaim: u('exclaim', x => String(x) + '!'),
  boom: u('boom', () => { throw new Error('kaboom') }),
  rev: u('rev', x => [...String(x)].reverse().join('')),
  len: u('len', x => String(String(x).length)),
  slow: u('slow', async x => { await new Promise(r => setTimeout(r, 20)); return x }),
  bytes: u('bytes', x => new TextEncoder().encode(String(x)), { produces: 'bytes' }),
  wantBytes: u('wantBytes', x => String((x as Uint8Array).length), { accepts: 'bytes' }),
  ctx: u('ctx', (_x, _p, c) => `${c?.env}:${c?.signal ? 'signal' : 'none'}`),
  withParam: u('withParam', (x, p) => `${x}:${p.n}`, { params: { n: { kind: 'number', label: 'n', default: 7 } } }),
}
const load = (id: string) => {
  const util = UTILS[id]
  if (!util) throw new Error(`unknown utility: ${id}`)
  return util
}
const step = (id: string, utilityId: string, extra: Partial<PipelineStep> = {}): PipelineStep =>
  ({ id, utilityId, enabled: true, params: {}, ...extra }) as PipelineStep

describe('runPipeline', () => {
  it('chains steps in order', async () => {
    const r = await runPipeline('hi', [step('a', 'upper'), step('b', 'exclaim')], { load })
    expect(r.out).toBe('HI!')
    expect(r.err).toEqual({})
    expect(r.halted).toBe(false)
  })

  it('passes disabled steps through and records why', async () => {
    const r = await runPipeline('hi', [step('a', 'upper', { enabled: false }), step('b', 'exclaim')], { load, previews: true })
    expect(r.out).toBe('hi!')
    expect(r.skipped.a).toBe('disabled')
    expect(r.previews.a).toBe('hi')
  })

  it('records previews and inputs per step', async () => {
    const r = await runPipeline('ab', [step('a', 'upper'), step('b', 'rev')], { load, previews: true })
    expect(r.inputs).toEqual({ a: 'ab', b: 'AB' })
    expect(r.previews).toEqual({ a: 'AB', b: 'BA' })
  })

  it('does not record previews unless asked', async () => {
    const r = await runPipeline('ab', [step('a', 'upper')], { load })
    expect(r.previews).toEqual({})
    expect(r.inputs).toEqual({})
  })

  it('times every executed step with the supplied clock', async () => {
    let t = 0
    const r = await runPipeline('x', [step('a', 'upper'), step('b', 'exclaim')], { load, clock: () => (t += 5) })
    expect(r.timings).toEqual({ a: 5, b: 5 })
  })

  it('resolves defaults for missing and blank params', async () => {
    expect((await runPipeline('x', [step('a', 'withParam')], { load })).out).toBe('x:7')
    expect((await runPipeline('x', [step('a', 'withParam', { params: { n: '' } } as any)], { load })).out).toBe('x:7')
    expect((await runPipeline('x', [step('a', 'withParam', { params: { n: 0 } } as any)], { load })).out).toBe('x:0')
  })

  it('coerces between value types', async () => {
    const r = await runPipeline('héllo', [step('a', 'wantBytes')], { load })
    expect(r.out).toBe('6')
  })

  it('passes env and signal to apply', async () => {
    const ac = new AbortController()
    const r = await runPipeline('x', [step('a', 'ctx')], { load, env: 'browser-worker', signal: ac.signal })
    expect(r.out).toBe('browser-worker:signal')
  })

  describe('error policies', () => {
    it('passthrough (default) records the error and continues with the input', async () => {
      const r = await runPipeline('hi', [step('a', 'boom'), step('b', 'exclaim')], { load, previews: true })
      expect(r.err.a).toBe('kaboom')
      expect(r.out).toBe('hi!')
      expect(r.previews.a).toBeUndefined()
    })

    it('stop halts the rest of the sequence', async () => {
      const r = await runPipeline('hi', [step('a', 'boom', { onError: 'stop' }), step('b', 'exclaim')], { load })
      expect(r.out).toBe('hi')
      expect(r.halted).toBe(true)
      expect(r.skipped.b).toBe('halted')
    })

    it('empty continues with an empty string', async () => {
      const r = await runPipeline('hi', [step('a', 'boom', { onError: 'empty' }), step('b', 'exclaim')], { load })
      expect(r.out).toBe('!')
    })

    it('reports an unknown utility as a step error, not a rejection', async () => {
      const r = await runPipeline('hi', [step('a', 'nope')], { load })
      expect(r.err.a).toBe('unknown utility: nope')
      expect(r.out).toBe('hi')
    })
  })

  describe('conditions', () => {
    it('skips a step whose condition fails and passes the input through', async () => {
      const cond = { kind: 'regex', pattern: '^\\d+$' } as const
      const r1 = await runPipeline('123', [step('a', 'exclaim', { condition: cond })], { load })
      const r2 = await runPipeline('abc', [step('a', 'exclaim', { condition: cond })], { load })
      expect(r1.out).toBe('123!')
      expect(r2.out).toBe('abc')
      expect(r2.skipped.a).toBe('condition')
    })

    it('supports negation, nonEmpty and type', () => {
      expect(evalCondition({ kind: 'nonEmpty' }, '')).toBe(false)
      expect(evalCondition({ kind: 'nonEmpty', negate: true }, '')).toBe(true)
      expect(evalCondition({ kind: 'type', type: 'bytes' }, new Uint8Array([1]))).toBe(true)
      expect(evalCondition({ kind: 'type', type: 'json' }, 'x')).toBe(false)
      expect(evalCondition(undefined, 'x')).toBe(true)
    })

    it('ignores the stateful g/y flags so repeated tests agree', () => {
      const c = { kind: 'regex', pattern: 'a', flags: 'gi' } as const
      expect(evalCondition(c, 'A')).toBe(true)
      expect(evalCondition(c, 'A')).toBe(true)
    })

    it('reports an invalid condition regex as that step\'s error', async () => {
      const r = await runPipeline('x', [step('a', 'exclaim', { condition: { kind: 'regex', pattern: '(' } })], { load })
      expect(r.err.a).toMatch(/regular expression|Unterminated|Invalid/i)
      expect(r.out).toBe('x')
    })
  })

  describe('branches', () => {
    const branch = (merge: any): PipelineStep => ({
      id: 'br', type: 'branch', enabled: true, merge,
      branches: [[step('b1', 'upper')], [step('b2', 'rev'), step('b3', 'exclaim')]],
    })

    it('runs every branch on the same input and concatenates', async () => {
      const r = await runPipeline('ab', [branch({ mode: 'concat', separator: '|' })], { load, previews: true })
      expect(r.out).toBe('AB|ba!')
      expect(r.previews.b1).toBe('AB')
      expect(r.previews.b3).toBe('ba!')
      expect(r.timings.br).toBeGreaterThanOrEqual(0)
    })

    it('merges as json, pick and zip', async () => {
      expect((await runPipeline('ab', [branch({ mode: 'json' })], { load })).out).toEqual(['AB', 'ba!'])
      expect((await runPipeline('ab', [branch({ mode: 'pick', index: 1 })], { load })).out).toBe('ba!')
      const zipped = mergeOutputs(['a\nb\nc', '1\n2'], { mode: 'zip' })
      expect(zipped).toBe('a\n1\nb\n2\nc')
    })

    it('refuses a merge whose lanes add up past maxValueSize before joining them; pick is exempt', async () => {
      // 'abcd' → 'ABCD' and 'dcba!': each lane fits in 6, together they do not
      const r = await runPipeline('abcd', [branch({ mode: 'concat', separator: '' })], { load, maxValueSize: 6 })
      expect(r.err.br).toMatch(/output is too large \(9 characters; the limit is 6 characters\)/)
      expect(r.out).toBe('abcd')
      expect((await runPipeline('abcd', [branch({ mode: 'pick', index: 1 })], { load, maxValueSize: 6 })).out).toBe('dcba!')
    })

    it('reports a pick beyond the last branch as the branch step\'s error', async () => {
      const r = await runPipeline('ab', [branch({ mode: 'pick', index: 5 })], { load })
      expect(r.err.br).toMatch(/does not exist/)
    })

    it('keeps a failing step inside a branch local to that branch', async () => {
      const s: PipelineStep = {
        id: 'br', type: 'branch', enabled: true, merge: { mode: 'concat', separator: ',' },
        branches: [[step('x', 'boom', { onError: 'stop' }), step('y', 'exclaim')], [step('z', 'upper')]],
      }
      const r = await runPipeline('q', [s, step('after', 'exclaim')], { load })
      expect(r.err.x).toBe('kaboom')
      expect(r.skipped.y).toBe('halted')
      expect(r.halted).toBe(false)
      expect(r.out).toBe('q,Q!')
    })
  })

  describe('macros', () => {
    it('runs its inner steps as one step', async () => {
      const m: PipelineStep = { id: 'm', type: 'macro', name: 'shout', enabled: true, steps: [step('m1', 'upper'), step('m2', 'exclaim')] }
      const r = await runPipeline('hey', [m, step('after', 'len')], { load, previews: true })
      expect(r.previews.m).toBe('HEY!')
      expect(r.out).toBe('4')
    })
  })

  describe('cancellation', () => {
    it('stops before the next step once aborted', async () => {
      const ac = new AbortController()
      const p = runPipeline('x', [step('a', 'slow'), step('b', 'exclaim')], { load, signal: ac.signal })
      ac.abort()
      const r = await p
      expect(r.aborted).toBe(true)
      expect(r.skipped.b ?? r.skipped.a).toBe('aborted')
    })

    it('does nothing when aborted before starting', async () => {
      const ac = new AbortController(); ac.abort()
      const r = await runPipeline('x', [step('a', 'exclaim')], { load, signal: ac.signal })
      expect(r.out).toBe('x')
      expect(r.aborted).toBe(true)
    })
  })

  it('emits progress events', async () => {
    const events: string[] = []
    await runPipeline('x', [step('a', 'upper'), step('b', 'boom'), step('c', 'exclaim', { enabled: false })],
      { load, onStep: e => events.push(`${e.id}:${e.status}`) })
    expect(events).toEqual(['a:start', 'a:done', 'b:start', 'b:error', 'c:skipped'])
  })

  it('enforces declared number bounds as a step error', async () => {
    const bounded = { ...UTILS.withParam, params: { n: { kind: 'number', label: 'count', default: 7, min: 0, max: 10, integer: true } } } as Utility
    const load = () => bounded
    const over = await runPipeline('x', [step('a', 'withParam', { params: { n: 1e9 } } as any)], { load })
    expect(over.err.a).toBe('count must be at most 10')
    expect(over.out).toBe('x')
    const frac = await runPipeline('x', [step('a', 'withParam', { params: { n: 2.5 } } as any)], { load })
    expect(frac.err.a).toBe('count must be a whole number')
    const ok = await runPipeline('x', [step('a', 'withParam', { params: { n: 10 } } as any)], { load })
    expect(ok.out).toBe('x:10')
  })

  it('refuses select values that name an Object.prototype member', async () => {
    // a share link's `alphabet: 'constructor'` reached `ALPHABETS[name]` and found Object
    const TABLE: Record<string, string> = { a: 'A', b: 'B' }
    const pick = u('pick', (_x, p) => String(TABLE[p.which as string] ?? 'unknown'), {
      params: {
        which: { kind: 'select', label: 'which', options: ['a', 'b'], default: 'a' },
        many: { kind: 'multiselect', label: 'many', options: ['a', 'b'], default: [] },
      },
    } as Partial<Utility>)
    const load = () => pick
    for (const bad of ['constructor', '__proto__', 'toString', 'hasOwnProperty']) {
      const r = await runPipeline('x', [step('s', 'pick', { params: { which: bad } } as any)], { load })
      expect(r.err.s, bad).toMatch(/^which must be one of: a, b$/)
      const m = await runPipeline('x', [step('s', 'pick', { params: { many: ['a', bad] } } as any)], { load })
      expect(m.err.s, bad).toMatch(/^many /)
    }
    // other values off the list stay the utility's business (legacy names, aliases)
    expect((await runPipeline('x', [step('s', 'pick', { params: { which: 'zzz' } } as any)], { load })).out).toBe('unknown')
    expect((await runPipeline('x', [step('s', 'pick', { params: { which: 'b' } } as any)], { load })).out).toBe('B')
  })

  it('stops a step whose output exceeds the size cap, applying its error policy', async () => {
    const huge = u('huge', () => 'a'.repeat(MAX_VALUE_SIZE + 1))
    const load = (id: string) => (id === 'huge' ? huge : UTILS[id])
    const r = await runPipeline('in', [step('a', 'huge'), step('b', 'exclaim')], { load })
    expect(r.err.a).toMatch(/output is too large .* the limit is 64 MB/)
    expect(r.out).toBe('in!')
  })

  it('passes a JSON null output through the size check', async () => {
    const nil = u('nil', () => null as unknown as string)
    const r = await runPipeline('x', [step('a', 'nil')], { load: () => nil })
    expect(r.err).toEqual({})
    expect(r.out).toBeNull()
  })

  it('handles bytes flowing between steps', async () => {
    const r = await runPipeline('abc', [step('a', 'bytes'), step('b', 'wantBytes')], { load })
    expect(r.out).toBe('3')
  })
})
