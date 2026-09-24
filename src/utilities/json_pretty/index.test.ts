import { describe, it, expect } from 'vitest'
import util from './index'

describe('json_pretty', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('json_pretty')
    expect(util.name).toBe('json pretty')
    expect(util.category).toBe('URL & JSON')
    expect(util.accepts).toEqual(['string'])
    expect(util.produces).toBe('string')
    expect(util.params.indent.default).toBe(2)
  })

  it('pretty-prints a JSON object', () => {
    const out = util.apply('{"a":1,"b":2}', { indent: 2 })
    expect(out).toBe('{\n  "a": 1,\n  "b": 2\n}')
  })

  it('pretty-prints with custom indent', () => {
    const out = util.apply('{"a":1}', { indent: 4 })
    expect(out).toBe('{\n    "a": 1\n}')
  })

  it('pretty-prints with indent 0 (compact)', () => {
    const out = util.apply('{"a":1,"b":2}', { indent: 0 })
    expect(out).toBe('{"a":1,"b":2}')
  })

  it('pretty-prints an array', () => {
    const out = util.apply('[1,2,3]', { indent: 2 })
    expect(out).toBe('[\n  1,\n  2,\n  3\n]')
  })

  it('pretty-prints nested objects', () => {
    const out = util.apply('{"a":{"b":1}}', { indent: 2 })
    expect(out).toBe('{\n  "a": {\n    "b": 1\n  }\n}')
  })

  it('throws on invalid JSON', () => {
    expect(() => util.apply('not json', { indent: 2 })).toThrow()
  })

  it('handles empty object', () => {
    expect(util.apply('{}', { indent: 2 })).toBe('{}')
  })

  it('handles empty array', () => {
    expect(util.apply('[]', { indent: 2 })).toBe('[]')
  })

  it('treats negative indent as 0', () => {
    const out = util.apply('{"a":1}', { indent: -5 })
    expect(out).toBe('{"a":1}')
  })

  it('falls back to the declared default indent 2 when the param is absent', () => {
    expect(util.apply('{"a":1,"b":2}', {})).toBe('{\n  "a": 1,\n  "b": 2\n}')
  })
})
