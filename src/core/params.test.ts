import { describe, it, expect } from 'vitest'
import { defaultParams, resolveParams, validateParam, validateParams, PARAM_KINDS } from './params'
import type { ParamSpec } from '../types/utility'

const util = {
  params: {
    n: { kind: 'number', label: 'n', default: 3, min: 1, max: 10, integer: true },
    r: { kind: 'range', label: 'r', default: 0.5, min: 0, max: 1 },
    tags: { kind: 'multiselect', label: 'tags', options: ['a', 'b', 'c'], default: ['a'] },
    kv: { kind: 'keyvalue', label: 'kv', default: [['x', '1']] },
    re: { kind: 'regex', label: 're', default: '\\d+', flagsParam: 'flags' },
    flags: { kind: 'string', label: 'flags', default: 'g' },
    name: { kind: 'string', label: 'name', default: '', required: true, maxLength: 5 },
  } as Record<string, ParamSpec>,
}

describe('params', () => {
  it('lists all thirteen kinds', () => {
    expect(PARAM_KINDS).toHaveLength(13)
  })

  it('copies array defaults so steps never share them', () => {
    const a = defaultParams(util), b = defaultParams(util)
    ;(a.tags as string[]).push('z')
    ;(a.kv as string[][])[0][1] = 'changed'
    expect(b.tags).toEqual(['a'])
    expect(b.kv).toEqual([['x', '1']])
    expect(util.params.kv).toMatchObject({ default: [['x', '1']] })
  })

  it('fills blanks for number and range but keeps text blanks', () => {
    const r = resolveParams(util, { n: '', r: '', name: '' })
    expect(r.n).toBe(3)
    expect(r.r).toBe(0.5)
    expect(r.name).toBe('')
  })

  it('wraps a legacy single-select string for a multiselect', () => {
    expect(resolveParams(util, { tags: 'b' }).tags).toEqual(['b'])
    expect(resolveParams(util, { tags: '' }).tags).toEqual([])
  })

  it('validates numbers against min, max and integer', () => {
    const n = util.params.n
    expect(validateParam(n, 5)).toBeNull()
    expect(validateParam(n, 0)).toMatch(/at least 1/)
    expect(validateParam(n, 11)).toMatch(/at most 10/)
    expect(validateParam(n, 2.5)).toMatch(/whole number/)
    expect(validateParam(n, 'abc')).toMatch(/number/)
  })

  it('validates required and maxLength', () => {
    expect(validateParam(util.params.name, '')).toBe('required')
    expect(validateParam(util.params.name, 'toolong')).toMatch(/at most 5/)
  })

  it('validates a regex using its sibling flags', () => {
    expect(validateParam(util.params.re, '(', { flags: 'g' })).toBeTruthy()
    expect(validateParam(util.params.re, 'a', { flags: 'zz' })).toBeTruthy()
    expect(validateParam(util.params.re, 'a', { flags: 'gi' })).toBeNull()
  })

  it('validates select, multiselect, keyvalue, color and date', () => {
    expect(validateParam({ kind: 'select', label: 's', options: ['x'] }, 'y')).toMatch(/one of/)
    expect(validateParam(util.params.tags, ['a', 'q'])).toMatch(/unknown option: q/)
    expect(validateParam(util.params.kv, [['a']])).toMatch(/pairs/)
    expect(validateParam({ kind: 'color', label: 'c' }, '#12345')).toBe('invalid color')
    expect(validateParam({ kind: 'color', label: 'c' }, '#123456')).toBeNull()
    expect(validateParam({ kind: 'color', label: 'c' }, 'rebeccapurple')).toBeNull()
    expect(validateParam({ kind: 'date', label: 'd' }, 'not a date')).toBe('invalid date')
    expect(validateParam({ kind: 'date', label: 'd' }, '2026-09-23')).toBeNull()
  })

  it('collects every problem by param name', () => {
    expect(validateParams(util, { n: 99, name: '' })).toEqual({ n: 'must be at most 10', name: 'required' })
    expect(validateParams(util, { name: 'ok' })).toEqual({})
  })
})
