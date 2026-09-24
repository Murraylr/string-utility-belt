import { describe, it, expect } from 'vitest'
import util from './index'
import back from '../json_to_yaml/index'

describe('yaml_to_json', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('yaml_to_json')
    expect(util.name).toBe('yaml to json')
    expect(util.category).toBe('Data Formats')
    expect(util.accepts).toBe('string')
    expect(util.produces).toBe('string')
    expect(Object.keys(util.params).sort()).toEqual(['allDocuments', 'indent'])
  })

  it('converts a realistic document', async () => {
    const yaml = 'name: utility-belt\nversion: 1.2.0\ntags:\n  - cli\n  - text\nactive: true\n'
    expect(await util.apply(yaml, { indent: 0 })).toBe(
      '{"name":"utility-belt","version":"1.2.0","tags":["cli","text"],"active":true}'
    )
  })

  it('returns empty string for empty input', async () => {
    expect(await util.apply('', {})).toBe('')
    expect(await util.apply('  \n\t ', {})).toBe('')
  })

  it('keeps unicode and astral characters intact', async () => {
    expect(await util.apply('ключ: café\nemoji: 😀🎉\n', { indent: 0 })).toBe('{"ключ":"café","emoji":"😀🎉"}')
  })

  it('honours the indent param', async () => {
    expect(await util.apply('a: 1\n', { indent: 2 })).toBe('{\n  "a": 1\n}')
    expect(await util.apply('a: 1\n', { indent: 4 })).toBe('{\n    "a": 1\n}')
    expect(await util.apply('a: 1\n', { indent: 0 })).toBe('{"a":1}')
  })

  it('turns a multi-document stream into an array', async () => {
    expect(await util.apply('a: 1\n---\nb: 2\n', { indent: 0 })).toBe('[{"a":1},{"b":2}]')
  })

  it('honours the allDocuments param for a single document', async () => {
    expect(await util.apply('a: 1\n', { allDocuments: true, indent: 0 })).toBe('[{"a":1}]')
    expect(await util.apply('a: 1\n', { allDocuments: false, indent: 0 })).toBe('{"a":1}')
    // A stream of several is already an array, so the flag changes nothing.
    expect(await util.apply('a: 1\n---\nb: 2\n', { allDocuments: true, indent: 0 })).toBe('[{"a":1},{"b":2}]')
  })

  it('falls back to the declared indent when the number box is cleared', async () => {
    // ParamsEditor stores '' for an emptied number input, and Number('') is 0 —
    // that must not silently minify the output.
    expect(await util.apply('a: 1\n', { indent: '' })).toBe('{\n  "a": 1\n}')
    expect(await util.apply('a: 1\n', { indent: null })).toBe('{\n  "a": 1\n}')
    expect(await util.apply('a: 1\n', {})).toBe('{\n  "a": 1\n}')
  })

  it('expands non-circular anchors into repeated values', async () => {
    expect(await util.apply('base: &b\n  x: 1\ncopy: *b\n', { indent: 0 })).toBe('{"base":{"x":1},"copy":{"x":1}}')
  })

  it('handles scalars, sequences and comment-only input', async () => {
    expect(await util.apply('- 1\n- two\n', { indent: 0 })).toBe('[1,"two"]')
    expect(await util.apply('42', { indent: 0 })).toBe('42')
    expect(await util.apply('# just a comment\n', { indent: 0 })).toBe('null')
  })

  it('throws on malformed YAML', async () => {
    await expect(util.apply('a: [1, 2\nb: 3', {})).rejects.toThrow(/invalid YAML/)
    await expect(util.apply('a:\n\tb: 1', {})).rejects.toThrow(/invalid YAML/)
  })

  it('throws on circular anchors that JSON cannot represent', async () => {
    await expect(util.apply('a: &x\n  b: *x\n', {})).rejects.toThrow(/circular/)
  })

  it('round-trips through json_to_yaml, unicode included', async () => {
    const yaml = 'title: café 😀\nitems:\n  - id: 1\n    ok: true\n  - id: 2\n    ok: false\n'
    const json = await util.apply(yaml, { indent: 2 })
    expect(await back.apply(json, {})).toBe(yaml)
  })
})
