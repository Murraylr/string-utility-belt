import { describe, it, expect } from 'vitest'
import util from './index'
import back from '../yaml_to_json/index'

describe('json_to_yaml', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('json_to_yaml')
    expect(util.name).toBe('json to yaml')
    expect(util.category).toBe('Data Formats')
    expect(util.accepts).toBe('string')
    expect(util.produces).toBe('string')
    expect(Object.keys(util.params).sort()).toEqual(['indent', 'lineWidth', 'sortKeys'])
  })

  it('converts a realistic object', async () => {
    const src = JSON.stringify({ name: 'utility-belt', version: '1.2.0', tags: ['cli', 'text'] })
    expect(await util.apply(src, {})).toBe('name: utility-belt\nversion: 1.2.0\ntags:\n  - cli\n  - text\n')
  })

  it('returns empty string for empty input', async () => {
    expect(await util.apply('', {})).toBe('')
    expect(await util.apply('   \n ', {})).toBe('')
  })

  it('preserves unicode and astral characters verbatim', async () => {
    const yaml = await util.apply(JSON.stringify({ 'ключ': 'café', emoji: '😀🎉' }), {})
    expect(yaml).toBe('ключ: café\nemoji: 😀🎉\n')
  })

  it('honours the indent param', async () => {
    const src = JSON.stringify({ outer: { inner: 1 } })
    expect(await util.apply(src, { indent: 4 })).toBe('outer:\n    inner: 1\n')
    expect(await util.apply(src, { indent: 2 })).toBe('outer:\n  inner: 1\n')
  })

  it('honours the lineWidth param', async () => {
    const src = JSON.stringify({ a: 'one two three four five six seven' })
    expect(await util.apply(src, { lineWidth: 20 })).toBe('a:\n  one two three four\n  five six seven\n')
    // 0 disables wrapping entirely
    expect(await util.apply(src, { lineWidth: 0 })).toBe('a: one two three four five six seven\n')
  })

  it('wraps at the default line width of 80', async () => {
    const note = 'lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore'
    expect(await util.apply(JSON.stringify({ note }), {})).toBe(
      'note: lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod\n  tempor incididunt ut labore\n'
    )
  })

  it('falls back to the declared defaults when a number box is cleared', async () => {
    // ParamsEditor stores '' for an emptied number input, and Number('') is 0 —
    // that must not silently mean "indent 1" / "never wrap".
    const nested = JSON.stringify({ outer: { inner: 1 } })
    expect(await util.apply(nested, { indent: '' })).toBe('outer:\n  inner: 1\n')
    expect(await util.apply(nested, { indent: null })).toBe('outer:\n  inner: 1\n')

    const note = 'lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore'
    const wrapped = 'note: lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod\n  tempor incididunt ut labore\n'
    expect(await util.apply(JSON.stringify({ note }), { lineWidth: '' })).toBe(wrapped)
    expect(await util.apply(JSON.stringify({ note }), { lineWidth: undefined })).toBe(wrapped)
  })

  it('honours the sortKeys param, recursively', async () => {
    const src = JSON.stringify({ b: 1, a: { z: 1, y: 2 } })
    expect(await util.apply(src, { sortKeys: true })).toBe('a:\n  y: 2\n  z: 1\nb: 1\n')
    expect(await util.apply(src, { sortKeys: false })).toBe('b: 1\na:\n  z: 1\n  y: 2\n')
  })

  it('handles top-level arrays, scalars and null', async () => {
    expect(await util.apply('[1, 2]', {})).toBe('- 1\n- 2\n')
    expect(await util.apply('null', {})).toBe('null\n')
    expect(await util.apply('"hello"', {})).toBe('hello\n')
  })

  it('throws on malformed JSON', async () => {
    await expect(util.apply('{ nope', {})).rejects.toThrow(/invalid JSON/)
    await expect(util.apply("{'a': 1}", {})).rejects.toThrow(/invalid JSON/)
  })

  it('round-trips through yaml_to_json, unicode included', async () => {
    const src = JSON.stringify({
      name: 'café 😀',
      nums: [1, 2.5, -3],
      nested: { ok: true, nil: null, deep: ['ключ', ''] }
    })
    const yaml = await util.apply(src, {})
    expect(await back.apply(yaml, { indent: 0 })).toBe(src)
  })
})
