import { describe, it, expect } from 'vitest'
import LZString from 'lz-string'
import { decodeShare, encodeShare, migratePipeline, sanitizeSteps, shareHash, SCHEMA_VERSION } from './serialize'
import type { PipelineDoc } from '../types/utility'

const doc: PipelineDoc = {
  v: 2,
  name: 'demo',
  steps: [
    { id: 'a', utilityId: 'trim', enabled: true, params: { mode: 'both' } },
    {
      id: 'b', type: 'branch', enabled: true, merge: { mode: 'concat', separator: ' | ' },
      branches: [[{ id: 'c', utilityId: 'case', enabled: true, params: { mode: 'upper' } }], []],
    },
    { id: 'd', type: 'macro', name: 'wrap', enabled: false, steps: [{ id: 'e', utilityId: 'reverse', enabled: true, params: {} }] },
  ],
}

describe('share encoding', () => {
  it('round-trips a pipeline with branches and macros', () => {
    expect(decodeShare(encodeShare(doc))).toEqual(doc)
  })

  it('round-trips an included input, unicode intact', () => {
    const withInput = { ...doc, input: 'café 日本語 🎉' }
    expect(decodeShare(encodeShare(withInput)).input).toBe('café 日本語 🎉')
  })

  it('produces a URL-safe payload', () => {
    expect(encodeShare(doc)).toMatch(/^[A-Za-z0-9+\-$]+$/)
    expect(shareHash('abc')).toBe('#/p/abc')
    expect(shareHash('abc', 'embed')).toBe('#/embed/abc')
  })

  it('rejects garbage and truncated links with a readable message', () => {
    expect(() => decodeShare('not-a-pipeline')).toThrow(/does not contain a pipeline|corrupted/)
    expect(() => decodeShare('')).toThrow(/does not contain a pipeline/)
  })

  it('refuses a link that would decompress to an enormous payload', () => {
    // lz-string expands quadratically: this ~3 KB link decodes to ~1.7 million characters
    const bomb = LZString.compressToEncodedURIComponent('a'.repeat(1_700_000))
    expect(bomb.length).toBeLessThan(4000)
    expect(() => decodeShare(bomb, 100_000)).toThrow(/too large to open safely/)
  })

  it('decodes identically to lz-string for normal links', () => {
    const payload = LZString.compressToEncodedURIComponent(JSON.stringify({ v: 2, steps: [{ id: 'x', utilityId: 'trim' }], input: 'héllo 🎉' }))
    expect(decodeShare(payload).input).toBe('héllo 🎉')
  })

  it('refuses a pipeline from a newer schema', () => {
    const future = LZString.compressToEncodedURIComponent(JSON.stringify({ v: SCHEMA_VERSION + 1, steps: [] }))
    expect(() => decodeShare(future)).toThrow(/newer version/)
  })
})

describe('migratePipeline', () => {
  it('upgrades v1 localStorage state', () => {
    const v1 = { steps: [{ id: 's1', utilityId: 'trim', enabled: true, params: {} }], showPreviews: true }
    expect(migratePipeline(v1)).toEqual({ v: 2, steps: [{ id: 's1', utilityId: 'trim', enabled: true, params: {} }] })
  })

  it('accepts a bare array of steps', () => {
    expect(migratePipeline([{ id: 'x', utilityId: 'trim' }]).steps).toEqual([{ id: 'x', utilityId: 'trim', enabled: true, params: {} }])
  })

  it('returns an empty pipeline for nonsense', () => {
    expect(migratePipeline(null)).toEqual({ v: 2, steps: [] })
    expect(migratePipeline('x')).toEqual({ v: 2, steps: [] })
  })
})

describe('sanitizeSteps (untrusted input)', () => {
  it('drops entries that are not steps', () => {
    expect(sanitizeSteps([null, 1, 'x', { id: 'no-utility' }, { id: 'ok', utilityId: 'trim' }]).map(s => s.id)).toEqual(['ok'])
  })

  it('mints ids for missing and duplicate ids', () => {
    const out = sanitizeSteps([{ utilityId: 'trim' }, { id: 'd', utilityId: 'a' }, { id: 'd', utilityId: 'b' }])
    expect(out[0].id).toBeTruthy()
    expect(out[1].id).toBe('d')
    expect(out[2].id).not.toBe('d')
  })

  // security review: RunResult maps (err, previews, timings, skipped) are plain objects
  // keyed by step id, so an id like "constructor" read back an inherited member — a
  // step that never failed showed the error "function Object() { [native code] }"
  it('re-mints ids that name an Object.prototype member, at every depth', () => {
    const hostile = ['__proto__', 'constructor', 'toString', 'hasOwnProperty', 'valueOf', '__defineGetter__']
    const raw = JSON.parse(JSON.stringify([
      ...hostile.map(id => ({ id, utilityId: 'trim' })),
      { id: 'b', type: 'branch', branches: [[{ id: 'constructor', utilityId: 'trim' }]] },
      { id: 'm', type: 'macro', name: 'm', steps: [{ id: 'toString', utilityId: 'trim' }] },
    ]))
    const out = sanitizeSteps(raw) as any[]
    const ids = [...out.slice(0, hostile.length).map(s => s.id), out[hostile.length].branches[0][0].id, out[hostile.length + 1].steps[0].id]
    for (const id of ids) expect(id in Object.prototype, id).toBe(false)
    expect(new Set(ids).size).toBe(ids.length)
    // ordinary ids are kept as they are
    expect(sanitizeSteps([{ id: 'constructor_2', utilityId: 'trim' }])[0].id).toBe('constructor_2')
  })

  it('strips prototype-polluting keys from params', () => {
    const raw = JSON.parse('[{"id":"a","utilityId":"trim","params":{"__proto__":{"polluted":true},"ok":1}}]')
    const [s] = sanitizeSteps(raw) as any
    expect(s.params.ok).toBe(1)
    expect(Object.prototype.hasOwnProperty.call(s.params, '__proto__')).toBe(false)
    expect(({} as any).polluted).toBeUndefined()
  })

  it('drops invalid conditions and error policies', () => {
    const [s] = sanitizeSteps([{ id: 'a', utilityId: 'trim', condition: { kind: 'wat' }, onError: 'explode' }]) as any
    expect(s.condition).toBeUndefined()
    expect(s.onError).toBeUndefined()
    const [t] = sanitizeSteps([{ id: 'b', utilityId: 'trim', condition: { kind: 'regex', pattern: 'x', negate: true }, onError: 'stop' }]) as any
    expect(t.condition).toEqual({ kind: 'regex', pattern: 'x', flags: '', negate: true })
    expect(t.onError).toBe('stop')
  })

  it('bounds nesting depth', () => {
    let deep: any = { id: 'leaf', utilityId: 'trim' }
    for (let i = 0; i < 20; i++) deep = { id: `m${i}`, type: 'macro', name: 'm', steps: [deep] }
    const [top] = sanitizeSteps([deep]) as any
    let depth = 0, cur = top
    while (cur?.steps?.length) { depth++; cur = cur.steps[0] }
    expect(depth).toBeLessThanOrEqual(9)
  })

  it('defaults a malformed merge to concat', () => {
    const [s] = sanitizeSteps([{ id: 'b', type: 'branch', branches: [[]], merge: 'lol' }]) as any
    expect(s.merge).toEqual({ mode: 'concat', separator: '\n' })
  })
})
