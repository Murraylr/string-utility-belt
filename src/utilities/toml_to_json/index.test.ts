import { describe, it, expect } from 'vitest'
import util from './index'
import back from '../json_to_toml/index'

describe('toml_to_json', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('toml_to_json')
    expect(util.name).toBe('toml to json')
    expect(util.category).toBe('Data Formats')
    expect(util.accepts).toBe('string')
    expect(util.produces).toBe('string')
    expect(Object.keys(util.params)).toEqual(['indent'])
  })

  it('converts a realistic document', async () => {
    const toml = 'title = "utility-belt"\nport = 8080\n\n[owner]\nname = "Ann"\nactive = true\n'
    expect(await util.apply(toml, { indent: 0 })).toBe('{"title":"utility-belt","port":8080,"owner":{"name":"Ann","active":true}}')
  })

  it('returns empty string for empty input', async () => {
    expect(await util.apply('', {})).toBe('')
    expect(await util.apply('  \n\t ', {})).toBe('')
  })

  it('keeps unicode and astral characters intact', async () => {
    expect(await util.apply('"ключ" = "café 😀"\n', { indent: 0 })).toBe('{"ключ":"café 😀"}')
  })

  it('honours the indent param', async () => {
    expect(await util.apply('a = 1\n', { indent: 2 })).toBe('{\n  "a": 1\n}')
    expect(await util.apply('a = 1\n', { indent: 4 })).toBe('{\n    "a": 1\n}')
    expect(await util.apply('a = 1\n', { indent: 0 })).toBe('{"a":1}')
  })

  it('reads arrays, array-of-tables and multi-line strings', async () => {
    expect(await util.apply('tags = [ "cli", "text" ]\n', { indent: 0 })).toBe('{"tags":["cli","text"]}')
    expect(await util.apply('[[x]]\na = 1\n\n[[x]]\na = 2\n', { indent: 0 })).toBe('{"x":[{"a":1},{"a":2}]}')
  })

  it('renders dates as ISO 8601 strings', async () => {
    expect(await util.apply('d = 1979-05-27T07:32:00Z\n', { indent: 0 })).toBe('{"d":"1979-05-27T07:32:00.000Z"}')
    expect(await util.apply('d = 1979-05-27T07:32:00+07:00\n', { indent: 0 })).toBe('{"d":"1979-05-27T07:32:00.000+07:00"}')
    // local (offset-less) date, date-time and time keep their reduced form
    expect(await util.apply('d = 1979-05-27\n', { indent: 0 })).toBe('{"d":"1979-05-27"}')
    expect(await util.apply('d = 1979-05-27T07:32:00\n', { indent: 0 })).toBe('{"d":"1979-05-27T07:32:00.000"}')
    expect(await util.apply('d = 07:32:00\n', { indent: 0 })).toBe('{"d":"07:32:00.000"}')
  })

  it('falls back to the declared indent when the number box is cleared', async () => {
    // ParamsEditor stores '' for an emptied number input, and Number('') is 0 —
    // that must not silently minify the output.
    expect(await util.apply('a = 1\n', { indent: '' })).toBe('{\n  "a": 1\n}')
    expect(await util.apply('a = 1\n', { indent: null })).toBe('{\n  "a": 1\n}')
    expect(await util.apply('a = 1\n', {})).toBe('{\n  "a": 1\n}')
  })

  it('reads dotted keys and TOML floats that JSON cannot hold', async () => {
    expect(await util.apply('a.b.c = 1\n', { indent: 0 })).toBe('{"a":{"b":{"c":1}}}')
    // JSON has no inf/nan literal, so they can only land as null
    expect(await util.apply('a = inf\nb = -inf\nc = nan\n', { indent: 0 })).toBe('{"a":null,"b":null,"c":null}')
  })

  it('treats a comment-only document as an empty table', async () => {
    expect(await util.apply('# nothing here\n', { indent: 0 })).toBe('{}')
  })

  it('throws on malformed TOML', async () => {
    await expect(util.apply('a = ', {})).rejects.toThrow(/invalid TOML/)
    await expect(util.apply('= 1', {})).rejects.toThrow(/invalid TOML/)
  })

  it('round-trips through json_to_toml, unicode included', async () => {
    const toml = 'title = "café 😀"\ncount = 3\ntags = [ "ключ", "b" ]\n\n[owner]\nname = "Ann"\nactive = true\n'
    const json = await util.apply(toml, { indent: 2 })
    expect(await back.apply(json, {})).toBe(toml)
  })
})
