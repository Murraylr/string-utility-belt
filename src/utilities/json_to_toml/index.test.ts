import { describe, it, expect } from 'vitest'
import util from './index'
import back from '../toml_to_json/index'

describe('json_to_toml', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('json_to_toml')
    expect(util.name).toBe('json to toml')
    expect(util.category).toBe('Data Formats')
    expect(util.accepts).toBe('string')
    expect(util.produces).toBe('string')
    expect(Object.keys(util.params)).toEqual([])
  })

  it('converts a realistic object', async () => {
    const src = JSON.stringify({ title: 'utility-belt', port: 8080, tags: ['cli', 'text'] })
    expect(await util.apply(src, {})).toBe('title = "utility-belt"\nport = 8080\ntags = [ "cli", "text" ]\n')
  })

  it('returns empty string for empty input', async () => {
    expect(await util.apply('', {})).toBe('')
    expect(await util.apply('   \n ', {})).toBe('')
  })

  it('keeps unicode and astral characters intact, quoting non-ASCII keys', async () => {
    expect(await util.apply(JSON.stringify({ 'ключ': 'café 😀' }), {})).toBe('"ключ" = "café 😀"\n')
  })

  it('writes nested objects as tables and object arrays as array-of-tables', async () => {
    expect(await util.apply(JSON.stringify({ owner: { name: 'Ann', active: true } }), {}))
      .toBe('[owner]\nname = "Ann"\nactive = true\n')
    expect(await util.apply(JSON.stringify({ x: [{ a: 1 }, { a: 2 }] }), {}))
      .toBe('[[x]]\na = 1\n\n[[x]]\na = 2\n')
  })

  it('nests deeper objects as dotted table headers, scalars first', async () => {
    // TOML requires bare keys before any table header, so the writer reorders.
    expect(await util.apply(JSON.stringify({ a: { b: { c: 1 } }, z: 2 }), {}))
      .toBe('z = 2\n\n[a.b]\nc = 1\n')
  })

  it('emits an empty document rather than a stray newline for {}', async () => {
    expect(await util.apply('{}', {})).toBe('')
  })

  it('reports null values instead of silently dropping the key', async () => {
    await expect(util.apply('{"a":1,"b":null}', {})).rejects.toThrow('TOML has no null: "b" is null')
    await expect(util.apply('{"t":{"a":null}}', {})).rejects.toThrow('TOML has no null: "t.a" is null')
    await expect(util.apply('{"a":[1,null]}', {})).rejects.toThrow('TOML has no null: "a[1]" is null')
    // and a key with a real value still survives
    expect(await util.apply('{"a":1,"b":""}', {})).toBe('a = 1\nb = ""\n')
  })

  it('throws when the document is not a top-level object', async () => {
    await expect(util.apply('[1, 2]', {})).rejects.toThrow(/top-level object/)
    await expect(util.apply('"hello"', {})).rejects.toThrow(/top-level object/)
    await expect(util.apply('null', {})).rejects.toThrow(/top-level object/)
  })

  it('throws on malformed JSON', async () => {
    await expect(util.apply('{ nope', {})).rejects.toThrow(/invalid JSON/)
  })

  it('round-trips through toml_to_json, unicode included', async () => {
    const src = JSON.stringify({
      title: 'café 😀',
      count: 3,
      ratio: 1.5,
      tags: ['ключ', 'b'],
      owner: { name: 'Ann', active: true }
    })
    const toml = await util.apply(src, {})
    expect(await back.apply(toml, { indent: 0 })).toBe(src)
  })
})
