import { describe, it, expect } from 'vitest'
import util from './index'
import iniToJson from '../ini_to_json'

const run = async (input: unknown, params: Record<string, unknown> = {}) =>
  String(await util.apply(input as never, params))

const back = async (ini: string, params: Record<string, unknown> = {}) =>
  JSON.parse(String(await iniToJson.apply(ini, { nested: true, typed: true, indent: 2, ...params })))

describe('json_to_ini', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('json_to_ini')
    expect(util.name).toBe('json to ini')
    expect(util.category).toBe('Data Formats')
    expect(util.accepts).toBe('json')
    expect(util.produces).toBe('string')
    expect(Object.keys(util.params).sort()).toEqual(['delimiter', 'spacing'])
  })

  it('writes globals first and nested objects as sections', async () => {
    const value = { app: 'belt', debug: false, server: { host: 'localhost', port: 8080 } }
    expect(await run(value)).toBe(['app=belt', 'debug=false', '', '[server]', 'host=localhost', 'port=8080'].join('\n'))
  })

  it('returns empty output for empty input', async () => {
    expect(await run('')).toBe('')
    expect(await run('   ')).toBe('')
    expect(await run({})).toBe('')
  })

  it('keeps unicode values unquoted and intact', async () => {
    expect(await run({ who: 'José 😀', emoji: '🎉' })).toBe('who=José 😀\nemoji=🎉')
  })

  it('honours the delimiter param', async () => {
    expect(await run({ a: '1' }, { delimiter: ':' })).toBe('a:1')
    expect(await run({ a: '1' }, { delimiter: '' })).toBe('a=1')
  })

  it('honours the spacing param', async () => {
    expect(await run({ a: '1' }, { spacing: true })).toBe('a = 1')
    expect(await run({ a: '1' }, { spacing: false })).toBe('a=1')
    expect(await run({ a: '1' }, { spacing: true, delimiter: ':' })).toBe('a : 1')
  })

  it('writes arrays as repeated key[] lines', async () => {
    expect(await run({ tags: ['a', 'b'], one: ['x'] })).toBe('tags[]=a\ntags[]=b\none[]=x')
  })

  it('quotes values that would not survive a round trip', async () => {
    expect(await run({ a: '  padded  ' })).toBe('a="  padded  "')
    expect(await run({ a: 'two\nlines' })).toBe('a="two\\nlines"')
    expect(await run({ a: 'x ; y' })).toBe('a="x ; y"')
    expect(await run({ a: '#hash' })).toBe('a="#hash"')
    expect(await run({ a: 'plain#hash' })).toBe('a=plain#hash')
  })

  it('writes deep nesting as dotted sections', async () => {
    expect(await run({ a: { b: { c: 'd' } } })).toBe(['[a]', '', '[a.b]', 'c=d'].join('\n'))
  })

  it('accepts a JSON string and rejects bad input', async () => {
    expect(await run('{"a":1}')).toBe('a=1')
    await expect(run('{oops')).rejects.toThrow(/not valid JSON/)
    await expect(run([1, 2, 3])).rejects.toThrow(/object at the top level/)
    await expect(run('42')).rejects.toThrow(/object at the top level/)
    await expect(run({ 'a=b': 1 })).rejects.toThrow(/contains the delimiter/)
  })

  it('round-trips through ini_to_json, unicode included', async () => {
    const value = {
      name: 'José 😀',
      count: 42,
      ratio: -1.5,
      enabled: true,
      missing: null,
      tags: ['α', 'β'],
      server: { host: 'localhost', port: 8080 },
      deep: { inner: { key: 'value ✓' } }
    }
    expect(await back(await run(value))).toEqual(value)
  })

  it('round-trips keys that collide with Object.prototype', async () => {
    // JSON.parse, not a literal: `{ __proto__: 1 }` would set a prototype
    const value = JSON.parse('{"__proto__":1,"toString":2,"constructor":3,"ok":"x"}')
    expect(await run(value)).toBe('__proto__=1\ntoString=2\nconstructor=3\nok=x')
    expect(await run(value, { spacing: true })).toBe('__proto__ = 1\ntoString = 2\nconstructor = 3\nok = x')
    const parsed = await back(await run(value))
    expect(Object.keys(parsed)).toEqual(['__proto__', 'toString', 'constructor', 'ok'])
    expect(parsed).toEqual(value)
  })

  it('round-trips ini text back to the same ini text', async () => {
    const ini = ['a=1', 'b[]=x', 'b[]=y', '', '[s]', 'k=v'].join('\n')
    const json = await back(ini)
    expect(await run(json)).toBe(ini)
  })
})
