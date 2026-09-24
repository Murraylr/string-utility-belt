import { describe, it, expect } from 'vitest'
import util from './index'
import unflattenUtil from '../json_unflatten/index'

const run = async (input: string, params: Record<string, unknown> = {}) =>
  (await util.apply(input, params)) as string

const runParsed = async (input: string, params: Record<string, unknown> = {}) =>
  JSON.parse(await run(input, params))

describe('json_flatten', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('json_flatten')
    expect(util.name).toBe('json flatten')
    expect(util.category).toBe('Data Formats')
    expect(util.accepts).toBe('string')
    expect(util.produces).toBe('string')
    expect(Object.keys(util.params).sort()).toEqual(['arrayNotation', 'delimiter', 'indent'])
  })

  it('flattens nested objects and arrays with bracket notation', async () => {
    expect(await run('{"user":{"name":"ada","tags":["x","y"]},"ok":true}', { indent: 0 }))
      .toBe('{"user.name":"ada","user.tags[0]":"x","user.tags[1]":"y","ok":true}')
  })

  it('uses the delimiter for array indices in dot notation', async () => {
    expect(await run('{"user":{"tags":["x","y"]}}', { arrayNotation: 'dot', indent: 0 }))
      .toBe('{"user.tags.0":"x","user.tags.1":"y"}')
  })

  it('honours a custom delimiter', async () => {
    expect(await run('{"a":{"b":{"c":1}},"d":[7]}', { delimiter: '/', indent: 0 }))
      .toBe('{"a/b/c":1,"d[0]":7}')
    expect(await run('{"a":{"b":1}}', { delimiter: '__', arrayNotation: 'dot', indent: 0 }))
      .toBe('{"a__b":1}')
  })

  it('keeps empty objects and arrays as leaf values', async () => {
    expect(await run('{"a":{},"b":[],"c":{"d":{}}}', { indent: 0 }))
      .toBe('{"a":{},"b":[],"c.d":{}}')
    expect(await run('{}', { indent: 0 })).toBe('{}')
    expect(await run('[]', { indent: 0 })).toBe('{}')
  })

  it('flattens a root array', async () => {
    expect(await runParsed('[{"a":1},2]', { indent: 0 })).toEqual({ '[0].a': 1, '[1]': 2 })
    expect(await runParsed('[{"a":1},2]', { arrayNotation: 'dot', indent: 0 }))
      .toEqual({ '0.a': 1, '1': 2 })
  })

  it('emits paths in document order even when a path looks like an array index', async () => {
    // asserted on the raw text: re-parsing into a JS object would hoist "1" and "2" itself
    expect(await run('[{"a":1},2,3]', { arrayNotation: 'dot', indent: 0 }))
      .toBe('{"0.a":1,"1":2,"2":3}')
    expect(await run('{"b":1,"a":{"2":"x"}}', { arrayNotation: 'dot', indent: 0 }))
      .toBe('{"b":1,"a.2":"x"}')
  })

  it('flattens a __proto__ key as data and pollutes nothing', async () => {
    expect(await run('{"__proto__":{"x":1},"a":2}', { indent: 0 })).toBe('{"__proto__.x":1,"a":2}')
    expect(await run('{"__proto__":5}', { indent: 0 })).toBe('{"__proto__":5}')
    expect(({} as Record<string, unknown>).x).toBeUndefined()
  })

  it('preserves unicode keys and values', async () => {
    expect(await run('{"café":{"😀":"值"}}', { indent: 0 })).toBe('{"café.😀":"值"}')
    expect(await runParsed('{"a":["😀","🇬🇧"]}', { indent: 0 }))
      .toEqual({ 'a[0]': '😀', 'a[1]': '🇬🇧' })
  })

  it('quotes ambiguous keys in bracket notation', async () => {
    expect(await runParsed('{"a.b":1,"0":2,"":3,"x[1]":4,"it\'s":5}', { indent: 0 })).toEqual({
      "['a.b']": 1,
      "['0']": 2,
      "['']": 3,
      "['x[1]']": 4,
      "it's": 5
    })
    // a quote inside an ambiguous key is escaped so the path stays parseable
    expect(await runParsed('{"a.b\'c":1}', { indent: 0 })).toEqual({ "['a.b\\'c']": 1 })
  })

  it('honours the indent param', async () => {
    expect(await run('{"a":{"b":1}}')).toBe('{\n  "a.b": 1\n}')
    expect(await run('{"a":{"b":1}}', { indent: 0 })).toBe('{"a.b":1}')
  })

  it('returns empty string for empty input', async () => {
    expect(await run('')).toBe('')
    expect(await run('  \n ')).toBe('')
  })

  it('throws on invalid JSON, scalar roots and an empty delimiter', async () => {
    expect(() => util.apply('{"a":', {})).toThrow(/invalid JSON/)
    expect(() => util.apply('42', {})).toThrow(/object or array at the root/)
    expect(() => util.apply('"text"', {})).toThrow(/object or array at the root/)
    expect(() => util.apply('{"a":1}', { delimiter: '' })).toThrow(/delimiter must not be empty/)
  })

  it('throws when dot notation collides two different paths', async () => {
    expect(() => util.apply('{"a.b":1,"a":{"b":2}}', { arrayNotation: 'dot' }))
      .toThrow(/path collision/)
  })

  it('round-trips through json_unflatten, including unicode and awkward keys', async () => {
    const doc = {
      user: { name: 'Ada', 'e-mail': 'a@b.c', tags: ['x', '😀'], meta: {} },
      list: [1, [2, 3], { deep: null }],
      'dotted.key': true,
      '0': 'numeric key',
      '': 'empty key',
      flag: false
    }
    const src = JSON.stringify(doc)
    const flat = await run(src, { indent: 0 })
    const back = (await unflattenUtil.apply(flat, { indent: 0 })) as string
    expect(JSON.parse(back)).toEqual(doc)

    const simple = { a: { b: [1, 2], c: 'héllo' }, d: null }
    const dotFlat = await run(JSON.stringify(simple), { arrayNotation: 'dot', indent: 0 })
    const dotBack = (await unflattenUtil.apply(dotFlat, { indent: 0 })) as string
    expect(JSON.parse(dotBack)).toEqual(simple)
  })
})
