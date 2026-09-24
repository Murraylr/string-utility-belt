import { describe, it, expect } from 'vitest'
import util from './index'
import flattenUtil from '../json_flatten/index'

const run = async (input: string, params: Record<string, unknown> = {}) =>
  (await util.apply(input, params)) as string

const runParsed = async (input: string, params: Record<string, unknown> = {}) =>
  JSON.parse(await run(input, params))

describe('json_unflatten', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('json_unflatten')
    expect(util.name).toBe('json unflatten')
    expect(util.category).toBe('Data Formats')
    expect(util.accepts).toBe('string')
    expect(util.produces).toBe('string')
    expect(Object.keys(util.params).sort()).toEqual(['delimiter', 'indent'])
  })

  it('rebuilds nested objects and arrays', async () => {
    expect(await run('{"user.name":"ada","user.tags[0]":"x","user.tags[1]":"y","ok":true}', { indent: 0 }))
      .toBe('{"user":{"name":"ada","tags":["x","y"]},"ok":true}')
  })

  it('rebuilds arrays from numeric dot segments', async () => {
    expect(await run('{"a.0":1,"a.1":2}', { indent: 0 })).toBe('{"a":[1,2]}')
    expect(await run('{"a.0.b":1}', { indent: 0 })).toBe('{"a":[{"b":1}]}')
  })

  it('rebuilds a root array', async () => {
    expect(await run('{"[0].a":1,"[1]":2}', { indent: 0 })).toBe('[{"a":1},2]')
    expect(await run('{"0.a":1,"1":2}', { indent: 0 })).toBe('[{"a":1},2]')
  })

  it('honours a custom delimiter', async () => {
    expect(await run('{"a/b/c":1,"d[0]":7}', { delimiter: '/', indent: 0 }))
      .toBe('{"a":{"b":{"c":1}},"d":[7]}')
    expect(await run('{"a__b":1}', { delimiter: '__', indent: 0 })).toBe('{"a":{"b":1}}')
  })

  it('keeps quoted bracket segments as literal object keys', async () => {
    expect(await runParsed(`{"['a.b']":1,"['0']":2,"['']":3,"['x[1]']":4}`, { indent: 0 }))
      .toEqual({ 'a.b': 1, '0': 2, '': 3, 'x[1]': 4 })
    // path text is ['a\'b'] — an escaped quote inside a quoted segment
    expect(await runParsed(`{"['a\\\\'b']":1}`, { indent: 0 })).toEqual({ "a'b": 1 })
    expect(await runParsed(`{"[\\"d.q\\"]":1}`, { indent: 0 })).toEqual({ 'd.q': 1 })
  })

  it('preserves unicode keys and values', async () => {
    expect(await run('{"café.😀":"值"}', { indent: 0 })).toBe('{"café":{"😀":"值"}}')
    expect(await runParsed('{"emoji😀key.a":"🇬🇧"}', { indent: 0 }))
      .toEqual({ 'emoji😀key': { a: '🇬🇧' } })
  })

  it('rebuilds a __proto__ segment as data and pollutes nothing', async () => {
    expect(await run('{"__proto__.a":1,"b":2}', { indent: 0 })).toBe('{"__proto__":{"a":1},"b":2}')
    expect(await run('{"a.__proto__.b":1}', { indent: 0 })).toBe('{"a":{"__proto__":{"b":1}}}')
    expect(await run('{"__proto__":1}', { indent: 0 })).toBe('{"__proto__":1}')
    expect(({} as Record<string, unknown>).a).toBeUndefined()
    expect((Object.prototype as unknown as Record<string, unknown>).b).toBeUndefined()
  })

  it('keeps path order, including quoted numeric keys', async () => {
    // asserted on the raw text: re-parsing into a JS object would hoist "0" and "1" itself
    expect(await run(`{"['1']":"one","['0']":"zero","b":2}`, { indent: 0 }))
      .toBe('{"1":"one","0":"zero","b":2}')
  })

  it('fills gaps with null and accepts out-of-order indices', async () => {
    expect(await run('{"a[2]":"c","a[0]":"a"}', { indent: 0 })).toBe('{"a":["a",null,"c"]}')
  })

  it('passes nested leaf values through untouched', async () => {
    expect(await run('{"a":{},"b":[],"c.d":{"kept":[1,2]}}', { indent: 0 }))
      .toBe('{"a":{},"b":[],"c":{"d":{"kept":[1,2]}}}')
  })

  it('honours the indent param', async () => {
    expect(await run('{"a.b":1}')).toBe('{\n  "a": {\n    "b": 1\n  }\n}')
    expect(await run('{"a.b":1}', { indent: 0 })).toBe('{"a":{"b":1}}')
  })

  it('returns empty string for empty input and an empty object for {}', async () => {
    expect(await run('')).toBe('')
    expect(await run('  \n ')).toBe('')
    expect(await run('{}', { indent: 0 })).toBe('{}')
  })

  it('throws on conflicting paths', async () => {
    expect(() => util.apply('{"a":1,"a.b":2}', {})).toThrow(/conflicting paths/)
    expect(() => util.apply('{"a.b":1,"a":2}', {})).toThrow(/conflicting paths/)
    expect(() => util.apply('{"a.0":1,"a.b":2}', {})).toThrow(/mix array indices and object keys/)
    expect(() => util.apply('{"a.b":1,"a.b.c":2}', {})).toThrow(/conflicting paths/)
  })

  it('throws on invalid input, bad paths and oversized indices', async () => {
    expect(() => util.apply('{"a":', {})).toThrow(/invalid JSON/)
    expect(() => util.apply('[1,2]', {})).toThrow(/flat object of path/)
    expect(() => util.apply('"text"', {})).toThrow(/flat object of path/)
    expect(() => util.apply('{"a.b":1}', { delimiter: '' })).toThrow(/delimiter must not be empty/)
    expect(() => util.apply('{"a[2000001]":1}', {})).toThrow(/too large/)
    expect(() => util.apply('{"a[0":1}', {})).toThrow(/unterminated/)
  })

  it('round-trips through json_flatten', async () => {
    const flat = { 'a.b[0]': 1, 'a.b[1]': 2, 'a.c': 'héllo', "['weird.key']": true, 'z[0].q': null }
    const nested = (await util.apply(JSON.stringify(flat), { indent: 0 })) as string
    const back = (await flattenUtil.apply(nested, { indent: 0 })) as string
    expect(JSON.parse(back)).toEqual(flat)
  })
})
