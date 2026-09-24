import { describe, it, expect } from 'vitest'
import util from './index'
import fromJsonl from '../jsonl_to_json/index'

describe('json_to_jsonl', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('json_to_jsonl')
    expect(util.name).toBe('json to jsonl')
    expect(util.category).toBe('Data Formats')
    expect(util.accepts).toBe('string')
    expect(util.produces).toBe('string')
    expect(util.params).toEqual({})
  })

  it('writes one compact value per line', async () => {
    const src = `[
      { "id": 1, "name": "Ada" },
      { "id": 2, "name": "Grace" }
    ]`
    expect(await util.apply(src, {}))
      .toBe('{"id":1,"name":"Ada"}\n{"id":2,"name":"Grace"}')
  })

  it('returns empty string for empty input', async () => {
    expect(await util.apply('', {})).toBe('')
    expect(await util.apply('  \n ', {})).toBe('')
  })

  it('emits an empty document for an empty array', async () => {
    expect(await util.apply('[]', {})).toBe('')
  })

  it('wraps a non-array document as a single line', async () => {
    expect(await util.apply('{"a":1}', {})).toBe('{"a":1}')
    expect(await util.apply('42', {})).toBe('42')
    expect(await util.apply('"hi"', {})).toBe('"hi"')
  })

  it('keeps unicode intact and never splits astral characters', async () => {
    const out = String(await util.apply('["😀👩‍🚀", "日本語", "café"]', {}))
    expect(out).toBe('"😀👩‍🚀"\n"日本語"\n"café"')
    expect(out.split('\n')).toHaveLength(3)
    expect(Array.from(JSON.parse(out.split('\n')[0]))).toContain('😀')
  })

  it('escapes embedded newlines so every record stays on one line', async () => {
    expect(await util.apply('["a\\nb", "c"]', {})).toBe('"a\\nb"\n"c"')
    expect(String(await util.apply('["a\\nb", "c"]', {})).split('\n')).toHaveLength(2)
  })

  it('keeps one record per line for U+2028 / U+2029, which JSON.stringify leaves raw', async () => {
    const LS = String.fromCharCode(0x2028)
    const PS = String.fromCharCode(0x2029)
    const src = JSON.stringify(['a' + LS + 'b', 'c' + PS + 'd', 'e'])
    const out = String(await util.apply(src, {}))
    expect(out).toContain(LS)
    expect(out.split('\n')).toHaveLength(3)
    expect(await fromJsonl.apply(out, { indent: 0 })).toBe(src)
  })

  it('throws on invalid JSON', () => {
    expect(() => util.apply('{oops}', {})).toThrow(/not valid JSON/)
    expect(() => util.apply('[1,2', {})).toThrow(/jsonl:/)
    expect(() => util.apply('[1,2]', {})).not.toThrow()
  })

  it('round-trips with jsonl_to_json, unicode included', async () => {
    const jsonl = '{"a":1}\n{"b":"😀"}\n[1,2]\nnull'
    const arr = String(await fromJsonl.apply(jsonl, { indent: 2 }))
    expect(await util.apply(arr, {})).toBe(jsonl)
  })
})
