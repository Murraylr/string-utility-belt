import { describe, it, expect } from 'vitest'
import util from './index'

const run = async (input: unknown, params: Record<string, unknown> = {}) =>
  String(await util.apply(input as never, params))

const obj = async (input: unknown, params: Record<string, unknown> = {}) =>
  JSON.parse(await run(input, params))

describe('ini_to_json', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('ini_to_json')
    expect(util.name).toBe('ini to json')
    expect(util.category).toBe('Data Formats')
    expect(util.accepts).toBe('string')
    expect(util.produces).toBe('string')
    expect(Object.keys(util.params).sort()).toEqual(['indent', 'nested', 'typed'])
  })

  it('parses globals and sections', async () => {
    const ini = ['app=belt', '', '[server]', 'host = localhost', 'port = 8080'].join('\n')
    expect(await obj(ini)).toEqual({ app: 'belt', server: { host: 'localhost', port: '8080' } })
  })

  it('returns an empty object for empty input', async () => {
    expect(await run('')).toBe('{}')
    expect(await run('   \n  \n')).toBe('{}')
  })

  it('drops ; and # comments but keeps # inside values', async () => {
    const ini = ['; a comment', '# another', 'color=#ff8800', 'name = belt ; trailing', 'q = "a ; b"'].join('\n')
    expect(await obj(ini)).toEqual({ color: '#ff8800', name: 'belt', q: 'a ; b' })
  })

  it('keeps unicode keys, sections and values intact', async () => {
    const ini = ['[café]', 'naïve = résumé 😀', 'emoji=🎉🎈'].join('\n')
    expect(await obj(ini)).toEqual({ 'café': { 'naïve': 'résumé 😀', emoji: '🎉🎈' } })
  })

  it('nests dotted section and key names when nested is true', async () => {
    const ini = ['[a.b]', 'c.d = 1', '[top]', 'x=y'].join('\n')
    expect(await obj(ini, { nested: true })).toEqual({ a: { b: { c: { d: '1' } } }, top: { x: 'y' } })
    expect(await obj(ini, { nested: false })).toEqual({ 'a.b': { 'c.d': '1' }, top: { x: 'y' } })
  })

  it('coerces types when typed is true', async () => {
    const ini = ['n = 42', 'f = -1.5e3', 'b = TRUE', 'o = off', 'z = null', 's = hello', 'q = "42"'].join('\n')
    expect(await obj(ini, { typed: true })).toEqual({
      n: 42, f: -1500, b: true, o: false, z: null, s: 'hello', q: '42'
    })
    expect(await obj(ini, { typed: false })).toEqual({
      n: '42', f: '-1.5e3', b: 'TRUE', o: 'off', z: 'null', s: 'hello', q: '42'
    })
  })

  it('keeps # and ; literal after an apostrophe in a bare value', async () => {
    // the apostrophe must not open a quoted region and hide the comment
    expect(await obj("greeting = don't stop ; a comment")).toEqual({ greeting: "don't stop" })
    expect(await obj("greeting = don't stop")).toEqual({ greeting: "don't stop" })
    expect(await obj("q = 'a ; b' ; tail")).toEqual({ q: 'a ; b' })
  })

  it('treats Object.prototype names as ordinary keys and sections', async () => {
    // asserted on the JSON text: an expected `{ __proto__: ... }` literal would
    // set a prototype rather than a key and make the test vacuous
    expect(await run('toString=1\nconstructor=2\nhasOwnProperty=3', { indent: 0 }))
      .toBe('{"toString":"1","constructor":"2","hasOwnProperty":"3"}')
    expect(await run('__proto__=evil\nsafe=1', { indent: 0 })).toBe('{"__proto__":"evil","safe":"1"}')
    expect(await run('[toString]\nx=1', { indent: 0 })).toBe('{"toString":{"x":"1"}}')
    expect(await run('[__proto__]\nx=1', { indent: 0 })).toBe('{"__proto__":{"x":"1"}}')
  })

  it('keeps integers that a JS number cannot hold as strings when typed', async () => {
    expect(await obj('big = 12345678901234567890', { typed: true })).toEqual({ big: '12345678901234567890' })
    expect(await obj('ok = 9007199254740991', { typed: true })).toEqual({ ok: 9007199254740991 })
  })

  it('honours the indent param', async () => {
    expect(await run('a=1', { indent: 0 })).toBe('{"a":"1"}')
    expect(await run('a=1', { indent: 4 })).toBe('{\n    "a": "1"\n}')
  })

  it('collects repeated keys and key[] into arrays', async () => {
    expect(await obj('t=a\nt=b\nt=c')).toEqual({ t: ['a', 'b', 'c'] })
    expect(await obj('t[]=only')).toEqual({ t: ['only'] })
  })

  it('unquotes and unescapes quoted values', async () => {
    expect(await obj('a = "  padded  "')).toEqual({ a: '  padded  ' })
    expect(await obj('a = "line\\nbreak\\ttab"')).toEqual({ a: 'line\nbreak\ttab' })
    expect(await obj("a = 'raw \\n kept'")).toEqual({ a: 'raw \\n kept' })
  })

  it('creates an empty object for a section with no keys', async () => {
    expect(await obj('[empty]')).toEqual({ empty: {} })
  })

  it('throws on malformed lines', async () => {
    await expect(run('this is not ini')).rejects.toThrow(/expected "key=value"/)
    await expect(run('[unterminated')).rejects.toThrow(/unterminated section header/)
    await expect(run('[]')).rejects.toThrow(/empty section name/)
    await expect(run('=novalue')).rejects.toThrow(/missing key/)
  })

  it('throws when a value and a section collide', async () => {
    await expect(run('a=1\n[a]\nb=2')).rejects.toThrow(/conflicting key/)
  })
})
