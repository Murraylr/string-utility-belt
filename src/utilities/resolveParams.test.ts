import { describe, it, expect } from 'vitest'
import { resolveParams, runPipeline, UTIL_MAP } from '@/utilities'
import type { Utility } from '@/types/utility'

const fixture: Utility = {
  id: 'fixture',
  name: 'fixture',
  category: 'Other',
  description: 'test double',
  params: {
    indent: { kind: 'number', label: 'indent', default: 2 },
    label: { kind: 'string', label: 'label', default: 'x' },
    loud: { kind: 'boolean', label: 'loud', default: true },
    mode: { kind: 'select', label: 'mode', options: ['a', 'b'], default: 'a' },
    noDefault: { kind: 'string', label: 'no default' } as any,
  },
  apply: (input: any) => String(input),
}

describe('resolveParams', () => {
  it('substitutes the default for a blank number param', () => {
    // ParamsEditor stores '' when the user clears a number box; Number('') is 0,
    // which would otherwise be taken as a deliberate zero
    expect(resolveParams(fixture, { indent: '' }).indent).toBe(2)
  })

  it('substitutes the default for missing and null params', () => {
    expect(resolveParams(fixture, {}).indent).toBe(2)
    expect(resolveParams(fixture, { indent: null }).indent).toBe(2)
    expect(resolveParams(fixture, {}).mode).toBe('a')
    expect(resolveParams(fixture, {}).loud).toBe(true)
  })

  it('keeps a deliberate zero', () => {
    expect(resolveParams(fixture, { indent: 0 }).indent).toBe(0)
  })

  it('keeps an empty string for non-number kinds', () => {
    // '' is a meaningful value for a pattern or separator
    expect(resolveParams(fixture, { label: '' }).label).toBe('')
  })

  it('keeps false and other explicit values', () => {
    expect(resolveParams(fixture, { loud: false }).loud).toBe(false)
    expect(resolveParams(fixture, { mode: 'b' }).mode).toBe('b')
  })

  it('leaves params that declare no default alone', () => {
    expect('noDefault' in resolveParams(fixture, {})).toBe(false)
  })

  it('does not mutate the caller\'s params object', () => {
    const original = { indent: '' }
    resolveParams(fixture, original)
    expect(original).toEqual({ indent: '' })
  })

  it('applies defaults through runPipeline for a real utility', async () => {
    // json_pretty defaults to indent 2; a cleared box must not collapse to indent 0
    expect(UTIL_MAP.json_pretty).toBeDefined()
    const { out } = await runPipeline('{"a":1}', [
      { id: 's1', utilityId: 'json_pretty', enabled: true, params: { indent: '' } },
    ])
    expect(out).toBe('{\n  "a": 1\n}')
  })

  it('applies defaults through runPipeline when params are missing entirely', async () => {
    const { out } = await runPipeline('{"a":1}', [
      { id: 's1', utilityId: 'json_pretty', enabled: true, params: {} },
    ])
    expect(out).toBe('{\n  "a": 1\n}')
  })
})
