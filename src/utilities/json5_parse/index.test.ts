import { describe, it, expect } from 'vitest'
import util from './index'

describe('json5_parse', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('json5_parse')
    expect(util.name).toBe('json5 / jsonc parse')
    expect(util.category).toBe('Data Formats')
    expect(util.accepts).toBe('string')
    expect(util.produces).toBe('string')
    expect(util.params.indent).toEqual({
      kind: 'number',
      label: 'indent',
      default: 2,
      min: 0,
      max: 10,
      integer: true
    })
  })

  it('parses a realistic jsonc config', async () => {
    const src = `{
      // the server block
      host: 'localhost',
      port: 8080,   /* inline */
      "tags": ['a', 'b',],
    }`
    expect(await util.apply(src, {})).toBe(
      '{\n  "host": "localhost",\n  "port": 8080,\n  "tags": [\n    "a",\n    "b"\n  ]\n}'
    )
  })

  it('returns empty string for empty or comment-only input', async () => {
    expect(await util.apply('', {})).toBe('')
    expect(await util.apply('   \n\t ', {})).toBe('')
    expect(await util.apply('// nothing here\n/* nor here */', {})).toBe('')
  })

  it('never treats comment markers inside strings as comments', async () => {
    expect(await util.apply('{ "url": "https://x.dev/a//b", "c": "/* not a comment */" }', { indent: 0 }))
      .toBe('{"url":"https://x.dev/a//b","c":"/* not a comment */"}')
  })

  it('honours the indent param', async () => {
    expect(await util.apply('{a:1}', { indent: 0 })).toBe('{"a":1}')
    expect(await util.apply('{a:1}', { indent: 4 })).toBe('{\n    "a": 1\n}')
    expect(await util.apply('{a:1}', {})).toBe('{\n  "a": 1\n}')
    // non-numeric indent falls back to the default
    expect(await util.apply('{a:1}', { indent: 'x' })).toBe('{\n  "a": 1\n}')
  })

  it('handles json5 number forms', async () => {
    expect(await util.apply('[0xFF, +1.5, .25, 10., 1e3, -0x10]', { indent: 0 }))
      .toBe('[255,1.5,0.25,10,1000,-16]')
  })

  it('rejects leading zeros, which neither JSON nor JSON5 allows', async () => {
    // `010` is a legacy octal literal, so silently reading it as 10 would be a guess
    expect(() => util.apply('[010]', {})).toThrow(/leading zero/)
    expect(() => util.apply('{ port: 08080 }', {})).toThrow(/leading zero/)
    expect(() => util.apply('-00', {})).toThrow(/leading zero/)
    // ...but a lone zero and a zero-prefixed fraction or hex value are fine
    expect(await util.apply('[0, 0.5, -0.25, 0x0F]', { indent: 0 })).toBe('[0,0.5,-0.25,15]')
  })

  it('maps Infinity and NaN to null (strict JSON has no literal for them)', async () => {
    expect(await util.apply('{ a: Infinity, b: -Infinity, c: NaN }', { indent: 0 }))
      .toBe('{"a":null,"b":null,"c":null}')
  })

  it('preserves unicode in keys, values and escapes', async () => {
    expect(await util.apply("{ café: '☕ 😀', 'ключ': \"日本語\" }", { indent: 0 }))
      .toBe('{"café":"☕ 😀","ключ":"日本語"}')
    // surrogate-pair escapes rebuild the astral code point
    const out = await util.apply("{ e: '\\uD83D\\uDE00' }", { indent: 0 })
    expect(out).toBe('{"e":"😀"}')
    expect(Array.from(JSON.parse(String(out)).e)).toHaveLength(1)
  })

  it('supports string escapes and line continuations', async () => {
    expect(await util.apply("['a\\tb', '\\x41', 'one\\\ntwo', \"it's\"]", { indent: 0 }))
      .toBe('["a\\tb","A","onetwo","it\'s"]')
  })

  it('parses nested structures and non-object roots', async () => {
    expect(await util.apply('[{a:[1,{b:2,},],},]', { indent: 0 })).toBe('[{"a":[1,{"b":2}]}]')
    expect(await util.apply("'bare string'", { indent: 0 })).toBe('"bare string"')
    expect(await util.apply('  42  ', { indent: 0 })).toBe('42')
  })

  it('does not let a __proto__ key pollute the prototype', async () => {
    const out = await util.apply('{ "__proto__": { "polluted": true } }', { indent: 0 })
    expect(out).toBe('{"__proto__":{"polluted":true}}')
    expect(({} as Record<string, unknown>).polluted).toBeUndefined()
  })

  it('throws clear errors on malformed input', () => {
    expect(() => util.apply('{ a: 1', {})).toThrow(/unterminated object/)
    expect(() => util.apply("{ a: 'oops }", {})).toThrow(/unterminated string/)
    expect(() => util.apply('{ a: 1 } trailing', {})).toThrow(/trailing characters/)
    expect(() => util.apply('{ /* nope }', {})).toThrow(/unterminated block comment/)
    expect(() => util.apply('{ 1abc: 2 }', {})).toThrow(/json5:/)
    expect(() => util.apply('[1 2]', {})).toThrow(/expected ',' or '\]'/)
    expect(() => util.apply('{ a: 1 }', {})).not.toThrow()
  })

  it('reports the line and column of a syntax error', () => {
    expect(() => util.apply('{\n  a: 1,\n  b: @\n}', {})).toThrow(/line 3, column 6/)
  })
})
