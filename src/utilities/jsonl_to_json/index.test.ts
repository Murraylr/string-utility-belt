import { describe, it, expect } from 'vitest'
import util from './index'
import toJsonl from '../json_to_jsonl/index'

describe('jsonl_to_json', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('jsonl_to_json')
    expect(util.name).toBe('jsonl to json')
    expect(util.category).toBe('Data Formats')
    expect(util.accepts).toBe('string')
    expect(util.produces).toBe('string')
    expect(Object.keys(util.params).sort()).toEqual(['indent', 'onError', 'skipBlank'])
  })

  it('collects one value per line into an array', async () => {
    const src = '{"id":1,"name":"Ada"}\n{"id":2,"name":"Grace"}'
    expect(await util.apply(src, { indent: 0 }))
      .toBe('[{"id":1,"name":"Ada"},{"id":2,"name":"Grace"}]')
  })

  it('returns an empty array for empty input', async () => {
    expect(await util.apply('', {})).toBe('[]')
    expect(await util.apply('   \n\n  ', {})).toBe('[]')
  })

  it('handles scalars, CRLF line endings and a trailing newline', async () => {
    expect(await util.apply('1\r\n"two"\r\ntrue\r\nnull\r\n', { indent: 0 }))
      .toBe('[1,"two",true,null]')
  })

  it('preserves unicode, including astral characters', async () => {
    const out = String(await util.apply('{"emoji":"👩‍🚀"}\n"日本語"', { indent: 0 }))
    expect(out).toBe('[{"emoji":"👩‍🚀"},"日本語"]')
    expect(JSON.parse(out)[0].emoji).toBe('👩‍🚀')
  })

  it('honours the indent param', async () => {
    expect(await util.apply('1\n2', { indent: 2 })).toBe('[\n  1,\n  2\n]')
    expect(await util.apply('1\n2', { indent: 0 })).toBe('[1,2]')
    expect(await util.apply('1\n2', {})).toBe('[\n  1,\n  2\n]')
  })

  it('skips interior blank lines when skipBlank is true and rejects them when false', async () => {
    expect(await util.apply('1\n\n   \n2', { indent: 0, skipBlank: true })).toBe('[1,2]')
    expect(() => util.apply('1\n\n2', { indent: 0, skipBlank: false })).toThrow(/line 2 is blank/)
    // a single trailing newline is never treated as a blank record
    expect(await util.apply('1\n2\n', { indent: 0, skipBlank: false })).toBe('[1,2]')
  })

  it('applies the onError param to unparseable lines', async () => {
    expect(() => util.apply('1\nnot json\n3', { indent: 0, onError: 'error' }))
      .toThrow(/line 2 is not valid JSON/)
    expect(await util.apply('1\nnot json\n3', { indent: 0, onError: 'skip' })).toBe('[1,3]')
    expect(() => util.apply('1\nnot json\n3', { indent: 0 })).toThrow(/jsonl:/)
    // onError: skip also swallows blank lines when skipBlank is off
    expect(await util.apply('1\n\n3', { indent: 0, skipBlank: false, onError: 'skip' })).toBe('[1,3]')
  })

  it('round-trips with json_to_jsonl, unicode included', async () => {
    const original = '[{"a":1,"s":"héllo 😀"},[1,2],"x",null,true]'
    const jsonl = String(await toJsonl.apply(original, {}))
    expect(await util.apply(jsonl, { indent: 0 })).toBe(original)
  })
})
