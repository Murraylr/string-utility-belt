import { describe, it, expect } from 'vitest'
import { runPipeline, evalCondition, mergeOutputs, MAX_EACH_ITEMS, MAX_VALUE_SIZE } from './runner'
import type { EachStep, PipelineStep, SplitSpec, Utility } from '../types/utility'

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
  failOn: u('failOn', x => { if (String(x).includes('bad')) throw new Error('bad item'); return String(x).toUpperCase() }),
  json: u('json', x => ({ v: String(x) }), { produces: 'json' }),
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

  describe('run on each', () => {
    const each = (steps: PipelineStep[], extra: Partial<EachStep> = {}, split: SplitSpec = { mode: 'lines' }): PipelineStep =>
      ({ id: 'ea', type: 'each', enabled: true, split, steps, ...extra }) as PipelineStep

    it('runs the steps on every line on its own and rejoins them', async () => {
      const r = await runPipeline('ab\ncd\nef', [each([step('i', 'rev'), step('j', 'upper')])], { load })
      expect(r.out).toBe('BA\nDC\nFE')
      expect(r.err).toEqual({})
      expect(r.items?.ea).toEqual({ total: 3, ran: 3, failed: 0, sample: 'line 1' })
    })

    it('keeps CRLF endings, a trailing newline and unicode', async () => {
      const r = await runPipeline('café\r\nñ🎉\n', [each([step('i', 'upper')])], { load })
      expect(r.out).toBe('CAFÉ\r\nÑ🎉\n')
    })

    it('leaves empty lines alone by default, and runs on them when asked', async () => {
      expect((await runPipeline('a\n\nb', [each([step('i', 'exclaim')])], { load })).out).toBe('a!\n\nb!')
      const all = await runPipeline('a\n\nb', [each([step('i', 'exclaim')], { skipEmpty: false })], { load })
      expect(all.out).toBe('a!\n!\nb!')
      expect(all.items?.ea.ran).toBe(3)
    })

    it('runs on each element of a JSON array and each value of an object, keeping the shape', async () => {
      const arr = await runPipeline('["ab", 7, {"k": 1}]', [each([step('i', 'rev')], {}, { mode: 'json-array' })], { load })
      expect(arr.out).toEqual(['ba', 7, '}1:"k"{'])
      const obj = await runPipeline({ user: 'ann', role: 'admin' }, [each([step('i', 'upper')], {}, { mode: 'json-values' })], { load })
      expect(obj.out).toEqual({ user: 'ANN', role: 'ADMIN' })
    })

    it('writes a JSON result into a line as compact JSON', async () => {
      expect((await runPipeline('a\nb', [each([step('i', 'json')])], { load })).out).toBe('{"v":"a"}\n{"v":"b"}')
    })

    it('splits on a literal delimiter', async () => {
      const r = await runPipeline('a;b;c', [each([step('i', 'upper')], {}, { mode: 'delimiter', separator: ';' })], { load })
      expect(r.out).toBe('A;B;C')
    })

    it('passes every item through unchanged with no steps', async () => {
      expect((await runPipeline('x\r\ny\n', [each([])], { load })).out).toBe('x\r\ny\n')
    })

    describe('item failures', () => {
      it('passthrough (default): a failed item keeps what its steps produced; the others still run', async () => {
        const r = await runPipeline('ok\nbad\nfine', [each([step('i', 'failOn'), step('j', 'exclaim')])], { load })
        expect(r.out).toBe('OK!\nbad!\nFINE!')
        expect(r.err.ea).toBe('1 of 3 lines failed (line 2: bad item)')
        expect(r.err.i).toBe('line 2: bad item')
        expect(r.items?.ea).toEqual({ total: 3, ran: 3, failed: 1, sample: 'line 2' })
        expect(r.halted).toBe(false)
      })

      it('counts every failure and names the first', async () => {
        const r = await runPipeline('bad1\nok\nbad2', [each([step('i', 'failOn')])], { load })
        expect(r.err.ea).toBe('2 of 3 lines failed (first: line 1: bad item)')
      })

      it('empty: a failed item becomes empty', async () => {
        const r = await runPipeline('ok\nbad\nfine', [each([step('i', 'failOn')], { onError: 'empty' })], { load })
        expect(r.out).toBe('OK\n\nFINE')
        expect(r.err.ea).toMatch(/^1 of 3 lines failed/)
      })

      it('stop: the first failed item fails the step and halts the pipeline', async () => {
        const r = await runPipeline('ok\nbad\nfine', [each([step('i', 'failOn')], { onError: 'stop' }), step('after', 'exclaim')], { load })
        expect(r.err.ea).toBe('line 2: bad item')
        expect(r.out).toBe('ok\nbad\nfine')
        expect(r.halted).toBe(true)
        expect(r.skipped.after).toBe('halted')
        expect(r.items?.ea.ran).toBe(2)
      })

      it('fails as a whole, under its own policy, when the input does not fit the split', async () => {
        const r = await runPipeline('not json', [each([step('i', 'upper')], {}, { mode: 'json-array' }), step('after', 'exclaim')], { load })
        expect(r.err.ea).toMatch(/^the input is not valid JSON/)
        expect(r.out).toBe('not json!')
      })
    })

    describe('previews', () => {
      it('show the first item that ran, when none failed', async () => {
        const r = await runPipeline('\nab\ncd', [each([step('i', 'upper')])], { load, previews: true })
        expect(r.inputs.i).toBe('ab')
        expect(r.previews.i).toBe('AB')
        expect(r.previews.ea).toBe('\nAB\nCD')
        expect(r.items?.ea.sample).toBe('line 2')
      })

      it('show the first item that failed, with every nested step describing that same item', async () => {
        const r = await runPipeline('ok\nbad\nbad2', [each([step('i', 'exclaim'), step('j', 'failOn')])], { load, previews: true })
        expect(r.inputs.i).toBe('bad')
        expect(r.previews.i).toBe('bad!')
        expect(r.err.j).toBe('line 2: bad item')
        expect(r.items?.ea.sample).toBe('line 2')
      })

      it('are not recorded unless asked', async () => {
        const r = await runPipeline('a', [each([step('i', 'upper')])], { load })
        expect(r.previews).toEqual({})
      })
    })

    it('evaluates its own condition on the whole input and nested conditions per item', async () => {
      const digits = { kind: 'regex', pattern: '^\\d+$' } as const
      const r = await runPipeline('12\nab\n34', [each([step('i', 'exclaim', { condition: digits })])], { load })
      expect(r.out).toBe('12!\nab\n34!')
      const gated = await runPipeline('12\nab', [each([step('i', 'exclaim')], { condition: digits })], { load })
      expect(gated.skipped.ea).toBe('condition')
      expect(gated.out).toBe('12\nab')
    })

    it('runs macros, branches and nested each steps per item', async () => {
      const macro: PipelineStep = { id: 'm', type: 'macro', name: 'shout', enabled: true, steps: [step('m1', 'upper'), step('m2', 'exclaim')] }
      expect((await runPipeline('a\nb', [each([macro])], { load })).out).toBe('A!\nB!')
      const branch: PipelineStep = {
        id: 'br', type: 'branch', enabled: true, merge: { mode: 'concat', separator: '=' },
        branches: [[step('b1', 'upper')], [step('b2', 'len')]],
      }
      expect((await runPipeline('ab\nc', [each([branch])], { load })).out).toBe('AB=2\nC=1')
      const inner: PipelineStep = { id: 'in', type: 'each', enabled: true, split: { mode: 'delimiter', separator: ',' }, steps: [step('x', 'rev')] }
      expect((await runPipeline('ab,cd\nef', [each([inner])], { load })).out).toBe('ba,dc\nfe')
    })

    it('limits the items one run may process, nested each steps included', async () => {
      const r = await runPipeline('a\nb\nc', [each([step('i', 'upper')])], { load, maxEachItems: 2 })
      expect(r.err.ea).toBe('the input has 3 lines; one run can process at most 2')
      expect(r.out).toBe('a\nb\nc')
      // 2 lines, then 2 items in each: 2 + 2 + 2 > 5, so the second line's inner each is refused
      const inner: PipelineStep = { id: 'in', type: 'each', enabled: true, split: { mode: 'delimiter', separator: ',' }, steps: [step('x', 'upper')] }
      const nested = await runPipeline('a,b\nc,d', [each([inner])], { load, maxEachItems: 5 })
      expect(nested.out).toBe('A,B\nc,d')
      expect(nested.err.ea).toBe('1 of 2 lines failed (line 2: too many items in this run: 4 already processed, and 2 more would pass the limit of 5)')
      expect(MAX_EACH_ITEMS).toBe(100_000)
    })

    it('stops as soon as the joined items outgrow maxValueSize', async () => {
      const r = await runPipeline('abc\ndef\nghi', [each([step('i', 'upper')])], { load, maxValueSize: 5 })
      expect(r.err.ea).toMatch(/output is too large \(6 characters; the limit is 5 characters\)/)
      expect(r.items?.ea.ran).toBe(2)
    })

    it('stops between items once aborted and drops the partial result', async () => {
      const ac = new AbortController()
      const stopper = u('stopper', x => { if (x === 'b') ac.abort(); return String(x).toUpperCase() })
      const r = await runPipeline('a\nb\nc', [each([step('i', 'stopper')]), step('after', 'exclaim')],
        { load: id => (id === 'stopper' ? stopper : load(id)), signal: ac.signal })
      expect(r.aborted).toBe(true)
      expect(r.out).toBe('a\nb\nc')
      expect(r.skipped.ea).toBe('aborted')
      expect(r.skipped.after).toBe('aborted')
      expect(r.items?.ea.ran).toBe(2)
    })

    it('loads each utility once, not once per item', async () => {
      let loads = 0
      const r = await runPipeline('a\nb\nc\nd', [each([step('i', 'upper'), step('j', 'exclaim')])],
        { load: id => { loads++; return load(id) } })
      expect(r.out).toBe('A!\nB!\nC!\nD!')
      expect(loads).toBe(2)
    })

    it('reports an unknown utility on every item as a failure, not a rejection', async () => {
      const r = await runPipeline('a\nb', [each([step('i', 'nope')])], { load })
      expect(r.err.ea).toBe('2 of 2 lines failed (first: line 1: unknown utility: nope)')
      expect(r.out).toBe('a\nb')
    })

    it('gives the host a turn between items once a time slice has passed', async () => {
      let turns = 0
      const r = await runPipeline('a\nb\nc', [each([step('i', 'slow')])],
        { load, yieldToHost: async () => { turns++ } })
      expect(r.out).toBe('a\nb\nc')
      expect(turns).toBeGreaterThanOrEqual(1)
    })

    it('sums nested timings over items and reports nested steps once, after the items', async () => {
      let t = 0
      const events: string[] = []
      const r = await runPipeline('a\nb\nc', [each([step('i', 'upper'), step('j', 'boom', { enabled: false })])],
        { load, clock: () => (t += 5), onStep: e => events.push(`${e.id}:${e.status}`) })
      expect(r.timings.i).toBe(15)
      expect(events).toEqual(['ea:start', 'i:done', 'j:skipped', 'ea:done'])
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
