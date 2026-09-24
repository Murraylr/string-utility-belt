import { describe, it, expect } from 'vitest'
import util from './index'

const run = async (input: string, params: Record<string, unknown> = {}) =>
  (await util.apply(input, params)) as any

describe('json_validate', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('json_validate')
    expect(util.name).toBe('json validate')
    expect(util.category).toBe('Data Formats')
    expect(util.accepts).toBe('string')
    expect(util.produces).toBe('json')
    expect(util.params.strict.kind).toBe('boolean')
  })

  it('accepts valid JSON', async () => {
    const r = await run('{"name":"ada","tags":[1,2,3],"ok":true,"nested":{"a":null}}')
    expect(r.valid).toBe(true)
    expect(r.error).toBeNull()
    expect(r.line).toBeNull()
    expect(r.excerpt).toBeNull()
  })

  it('accepts bare top-level values', async () => {
    expect((await run('null')).valid).toBe(true)
    expect((await run('42')).valid).toBe(true)
    expect((await run('"hi"')).valid).toBe(true)
    expect((await run('[]')).valid).toBe(true)
    expect((await run('-1.5e10')).valid).toBe(true)
  })

  it('reports empty input without throwing', async () => {
    expect(() => util.apply('', {})).not.toThrow()
    const r = await run('')
    expect(r.valid).toBe(false)
    expect(r.error).toBe('empty input')
    expect(r.line).toBeNull()
    expect((await run('   \n  ')).error).toBe('empty input')
  })

  it('never throws on garbage input', async () => {
    expect(() => util.apply('<<<not json>>>', {})).not.toThrow()
    expect(() => util.apply('{"a":', { strict: false })).not.toThrow()
    const r = await run('<<<not json>>>')
    expect(r.valid).toBe(false)
    expect(typeof r.error).toBe('string')
  })

  it('locates a trailing comma', async () => {
    const r = await run('{"a": 1,}')
    expect(r.valid).toBe(false)
    expect(r.error).toMatch(/trailing comma/)
    expect(r.line).toBe(1)
    expect(r.column).toBe(8)
    expect(r.excerpt).toBe('{"a": 1,}')
  })

  it('reports the line, column and source line of a multi-line error', async () => {
    const r = await run('{\n  "a": 1\n  "b": 2\n}')
    expect(r.valid).toBe(false)
    expect(r.line).toBe(3)
    expect(r.column).toBe(3)
    expect(r.excerpt).toBe('  "b": 2')
    expect(r.error).toMatch(/expected ',' or '}'/)
  })

  it('counts columns in code points, not UTF-16 units', async () => {
    const r = await run('["😀" 1]')
    expect(r.valid).toBe(false)
    expect(r.line).toBe(1)
    expect(r.column).toBe(6)
    expect(r.excerpt).toBe('["😀" 1]')
  })

  it('accepts unicode content and escapes', async () => {
    expect((await run('{"emoji":"😀","ru":"Привет","esc":"\\uD83D\\uDE00"}')).valid).toBe(true)
    const r = await run('{"emoji":"😀}')
    expect(r.valid).toBe(false)
    expect(r.error).toMatch(/unterminated string/)
  })

  it('rejects malformed numbers, escapes and control characters in strict mode', async () => {
    const num = await run('{"a": 01}')
    expect(num.valid).toBe(false)
    expect(num.error).toBe('invalid number')
    expect(num.column).toBe(7)
    expect((await run('{"a": "\\q"}')).error).toMatch(/invalid escape sequence/)
    expect((await run('{"a": "bad\nbreak"}')).error).toMatch(/unescaped control character/)
    expect((await run('["\\uZZZZ"]')).error).toMatch(/invalid \\u escape/)
  })

  it('rejects JSON5 syntax when strict is true (the default)', async () => {
    expect((await run('{a: 1}', { strict: true })).valid).toBe(false)
    expect((await run("{'a': 1}", { strict: true })).error).toMatch(/single-quoted/)
    expect((await run('// hi\n{"a":1}', { strict: true })).valid).toBe(false)
    expect((await run('{"a":1}extra', { strict: true })).error).toMatch(/trailing content/)
    expect((await run('{a: 1}')).valid).toBe(false)
  })

  it('tolerates JSON5-ish syntax when strict is false', async () => {
    const r = await run("{a: 1, /* note */ b: 'two', c: [1,2,], d: NaN, e: 0xff, f: .5,}", { strict: false })
    expect(r.valid).toBe(true)
    expect(r.error).toBeNull()
    expect((await run('// leading comment\n{"a":1}', { strict: false })).valid).toBe(true)
    expect((await run('[1, 2, 3,]', { strict: false })).valid).toBe(true)
  })

  it('still reports real errors when strict is false', async () => {
    const r = await run('{a: 1 /* unterminated', { strict: false })
    expect(r.valid).toBe(false)
    expect(r.error).toMatch(/unterminated block comment/)
    const missing = await run('{"a": }', { strict: false })
    expect(missing.valid).toBe(false)
    expect(missing.column).toBe(7)
  })

  it('applies JSON whitespace rules strictly but tolerates unicode space and a BOM when lenient', async () => {
    const nbsp = '{ "a": 1}'
    expect((await run(nbsp)).valid).toBe(false)
    expect((await run(nbsp)).column).toBe(2)
    expect((await run(nbsp, { strict: false })).valid).toBe(true)
    const bom = '﻿{"a":1}'
    expect((await run(bom)).valid).toBe(false)
    expect((await run(bom, { strict: false })).valid).toBe(true)
  })

  it('truncates a very long error line into a windowed excerpt', async () => {
    // line is {"a":" + 400 x + " 1}  (410 chars); the error sits at the '1', near the end
    const long = `{"a":"${'x'.repeat(400)}" }`.replace('" }', '" 1}')
    const r = await run(long)
    expect(r.valid).toBe(false)
    expect(r.column).toBe(409)
    expect(r.excerpt).toBe(`…${'x'.repeat(116)}" 1}`)
    expect(Array.from(r.excerpt as string).length).toBe(121)
  })
})
