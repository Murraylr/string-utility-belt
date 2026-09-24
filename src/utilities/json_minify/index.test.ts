import { describe, it, expect } from 'vitest'
import util from './index'

describe('json_minify', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('json_minify')
    expect(util.category).toBe('URL & JSON')
  })

  it('minifies a pretty-printed object', () => {
    const input = '{\n  "a": 1,\n  "b": 2\n}'
    expect(util.apply(input, {})).toBe('{"a":1,"b":2}')
  })

  it('minifies an array', () => {
    expect(util.apply('[ 1, 2, 3 ]', {})).toBe('[1,2,3]')
  })

  it('handles already-minified JSON', () => {
    expect(util.apply('{"a":1}', {})).toBe('{"a":1}')
  })

  it('handles nested objects', () => {
    const input = '{\n  "a": {\n    "b": 1\n  }\n}'
    expect(util.apply(input, {})).toBe('{"a":{"b":1}}')
  })

  it('throws on invalid JSON', () => {
    expect(() => util.apply('not json', {})).toThrow()
  })

  it('handles empty object', () => {
    expect(util.apply('{}', {})).toBe('{}')
  })

  it('handles empty array', () => {
    expect(util.apply('[]', {})).toBe('[]')
  })
})
