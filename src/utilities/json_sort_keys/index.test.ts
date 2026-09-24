import { describe, it, expect } from 'vitest'
import util from './index'

const run = async (input: string, params: Record<string, unknown> = {}) =>
  (await util.apply(input, params)) as string

describe('json_sort_keys', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('json_sort_keys')
    expect(util.name).toBe('json sort keys')
    expect(util.category).toBe('Data Formats')
    expect(util.accepts).toBe('string')
    expect(util.produces).toBe('string')
    expect(Object.keys(util.params).sort()).toEqual(['deep', 'direction', 'indent', 'sortArrays'])
  })

  it('sorts keys ascending by default', async () => {
    expect(await run('{"banana":1,"apple":2,"cherry":3}', { indent: 0 }))
      .toBe('{"apple":2,"banana":1,"cherry":3}')
  })

  it('sorts keys descending', async () => {
    expect(await run('{"banana":1,"apple":2,"cherry":3}', { direction: 'desc', indent: 0 }))
      .toBe('{"cherry":3,"banana":1,"apple":2}')
  })

  it('sorts every depth when deep is true (the default)', async () => {
    expect(await run('{"z":{"y":1,"x":{"b":2,"a":3}},"a":[{"n":1,"m":2}]}', { indent: 0 }))
      .toBe('{"a":[{"m":2,"n":1}],"z":{"x":{"a":3,"b":2},"y":1}}')
  })

  it('sorts only the root when deep is false', async () => {
    expect(await run('{"b":{"d":1,"c":2},"a":3}', { deep: false, indent: 0 }))
      .toBe('{"a":3,"b":{"d":1,"c":2}}')
  })

  it('leaves arrays alone unless sortArrays is on', async () => {
    expect(await run('{"a":[3,1,2]}', { indent: 0 })).toBe('{"a":[3,1,2]}')
    expect(await run('{"a":[3,1,2]}', { sortArrays: true, indent: 0 })).toBe('{"a":[1,2,3]}')
  })

  it('orders mixed array members by type then value', async () => {
    const src = '[null,"b",2,true,[1],{"a":1},"a",1]'
    expect(await run(src, { sortArrays: true, indent: 0 }))
      .toBe('[null,true,1,2,"a","b",[1],{"a":1}]')
    expect(await run(src, { sortArrays: true, direction: 'desc', indent: 0 }))
      .toBe('[{"a":1},[1],"b","a",2,1,true,null]')
  })

  it('sorts a root array only when deep is false and sortArrays is on', async () => {
    expect(await run('[{"b":1,"a":2},{"d":3,"c":4}]', { deep: false, sortArrays: false, indent: 0 }))
      .toBe('[{"b":1,"a":2},{"d":3,"c":4}]')
    expect(await run('["b","a"]', { deep: false, sortArrays: true, indent: 0 })).toBe('["a","b"]')
  })

  it('sorts integer-like keys instead of letting the engine hoist them', async () => {
    // "1" < "10" < "2" by code point; a plain JS object would emit 1,2,10 whatever the sort said
    expect(await run('{"10":1,"2":2,"1":3,"b":4,"a":5}', { indent: 0 }))
      .toBe('{"1":3,"10":1,"2":2,"a":5,"b":4}')
    expect(await run('{"10":1,"2":2,"1":3,"b":4,"a":5}', { direction: 'desc', indent: 0 }))
      .toBe('{"b":4,"a":5,"2":2,"10":1,"1":3}')
    expect(await run('{"x":{"10":1,"9":2}}', { indent: 0 })).toBe('{"x":{"10":1,"9":2}}')
    expect(await run('{"x":{"10":1,"9":2}}', { direction: 'desc', indent: 0 })).toBe('{"x":{"9":2,"10":1}}')
  })

  it('keeps a __proto__ key as data and pollutes nothing', async () => {
    expect(await run('{"b":1,"__proto__":{"x":1},"a":2}', { indent: 0 }))
      .toBe('{"__proto__":{"x":1},"a":2,"b":1}')
    expect(await run('{"b":1,"__proto__":5}', { direction: 'desc', indent: 0 }))
      .toBe('{"b":1,"__proto__":5}')
    expect(await run('{"outer":{"b":1,"__proto__":{"deep":true}}}', { indent: 0 }))
      .toBe('{"outer":{"__proto__":{"deep":true},"b":1}}')
    expect(({} as Record<string, unknown>).x).toBeUndefined()
    expect(([] as unknown as Record<string, unknown>).deep).toBeUndefined()
  })

  it('orders unicode keys by code point', async () => {
    const out = await run('{"😀":1,"é":2,"z":3,"a":4}', { indent: 0 })
    expect(out).toBe('{"a":4,"z":3,"é":2,"😀":1}')
    expect(Object.keys(JSON.parse(out))).toEqual(['a', 'z', 'é', '😀'])
  })

  it('honours the indent param', async () => {
    expect(await run('{"b":1,"a":2}')).toBe('{\n  "a": 2,\n  "b": 1\n}')
    expect(await run('{"b":1,"a":2}', { indent: 4 })).toBe('{\n    "a": 2,\n    "b": 1\n}')
    expect(await run('{"b":1,"a":2}', { indent: 0 })).toBe('{"a":2,"b":1}')
  })

  it('returns empty string for empty input', async () => {
    expect(await run('')).toBe('')
    expect(await run('   \n ')).toBe('')
  })

  it('throws on invalid JSON', async () => {
    expect(() => util.apply('{"a":', {})).toThrow(/invalid JSON/)
    expect(() => util.apply('not json', {})).toThrow(/invalid JSON/)
  })

  it('passes scalars and empty containers through unchanged', async () => {
    expect(await run('42')).toBe('42')
    expect(await run('"héllo"')).toBe('"héllo"')
    expect(await run('{}')).toBe('{}')
    expect(await run('[]')).toBe('[]')
  })
})
