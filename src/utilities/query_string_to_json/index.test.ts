import { describe, it, expect } from 'vitest'
import util from './index'
import toQueryString from '../json_to_query_string/index'

const parse = async (input: string, params: Record<string, unknown> = {}) =>
  JSON.parse(String(await util.apply(input, params)))

describe('query_string_to_json', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('query_string_to_json')
    expect(util.name).toBe('query string to json')
    expect(util.category).toBe('Web & Dev')
    expect(util.accepts).toBe('string')
    expect(util.produces).toBe('string')
    expect(Object.keys(util.params).sort()).toEqual(['indent', 'nested', 'typed'])
  })

  it('parses a flat query string', async () => {
    expect(await parse('q=hello%20world&page=2')).toEqual({ q: 'hello world', page: '2' })
    expect(await parse('a=1&b')).toEqual({ a: '1', b: '' })
    expect(await parse('plus=a+b')).toEqual({ plus: 'a b' })
  })

  it('returns an empty object for empty input', async () => {
    expect(await util.apply('', {})).toBe('{}')
    expect(await util.apply('?', {})).toBe('{}')
    expect(await util.apply('   ', {})).toBe('{}')
  })

  it('supports every nesting mode', async () => {
    expect(await parse('filter[color]=red&filter[size]=xl')).toEqual({
      filter: { color: 'red', size: 'xl' }
    })
    expect(await parse('a.b=1', { nested: 'dot' })).toEqual({ a: { b: '1' } })
    expect(await parse('a.b=1', { nested: 'auto' })).toEqual({ a: { b: '1' } })
    expect(await parse('a[b]=1', { nested: 'none' })).toEqual({ 'a[b]': '1' })
    expect(await parse('a.b=1', { nested: 'bracket' })).toEqual({ 'a.b': '1' })
  })

  it('builds arrays from [], indices and repeated keys', async () => {
    expect(await parse('tags[]=a&tags[]=b')).toEqual({ tags: ['a', 'b'] })
    expect(await parse('tags[0]=a&tags[1]=b')).toEqual({ tags: ['a', 'b'] })
    expect(await parse('a=1&a=2&a=3')).toEqual({ a: ['1', '2', '3'] })
    expect(await parse('items[][x]=1&items[][y]=2')).toEqual({ items: [{ x: '1', y: '2' }] })
    expect(await parse('items[][x]=1&items[][x]=2')).toEqual({ items: [{ x: '1' }, { x: '2' }] })
    expect(await parse('a[0]=x&a[2]=y')).toEqual({ a: { '0': 'x', '2': 'y' } })
  })

  it('reads keys that mix brackets and dots', async () => {
    expect(await parse('a[].b=1&a[].b=2')).toEqual({ a: [{ b: '1' }, { b: '2' }] })
    expect(await parse('a[0].b=1')).toEqual({ a: [{ b: '1' }] })
    expect(await parse('a.b[c]=1')).toEqual({ a: { b: { c: '1' } } })
    // an empty dot segment is meaningless, so the key stays literal
    expect(await parse('a..b=1')).toEqual({ 'a..b': '1' })
  })

  it('never writes through to Object.prototype', async () => {
    expect(await util.apply('a[__proto__][polluted]=yes', { indent: 0 })).toBe(
      '{"a":{"__proto__":{"polluted":"yes"}}}'
    )
    expect(await util.apply('constructor[prototype][z]=1', { indent: 0 })).toBe(
      '{"constructor":{"prototype":{"z":"1"}}}'
    )
    expect(({} as Record<string, unknown>).polluted).toBeUndefined()
    expect(({} as Record<string, unknown>).z).toBeUndefined()
  })

  it('coerces values only when typed is on', async () => {
    expect(await parse('n=42&f=1.5&ok=true&no=false&nil=null&z=007')).toEqual({
      n: '42',
      f: '1.5',
      ok: 'true',
      no: 'false',
      nil: 'null',
      z: '007'
    })
    expect(await parse('n=42&f=1.5&ok=true&no=false&nil=null&z=007', { typed: true })).toEqual({
      n: 42,
      f: 1.5,
      ok: true,
      no: false,
      nil: null,
      z: '007'
    })
  })

  it('does not lose digits when typing long integers', async () => {
    expect(await parse('id=9007199254740993&n=1e3&big=12345678901234567890', { typed: true })).toEqual({
      id: '9007199254740993',
      n: 1000,
      big: '12345678901234567890'
    })
  })

  it('honours the indent parameter', async () => {
    expect(await util.apply('a=1', { indent: 0 })).toBe('{"a":"1"}')
    expect(await util.apply('a=1', { indent: 2 })).toBe('{\n  "a": "1"\n}')
    expect(await util.apply('a=1', { indent: 4 })).toBe('{\n    "a": "1"\n}')
  })

  it('accepts a full url and ignores the fragment', async () => {
    expect(await parse('https://example.dev/search?q=hi&lang=en#results')).toEqual({
      q: 'hi',
      lang: 'en'
    })
    // a url with no query string has no parameters — its path is not a query
    expect(await util.apply('https://example.dev/search', {})).toBe('{}')
    expect(await util.apply('https://example.dev/search#results', {})).toBe('{}')
  })

  it('decodes non-ascii and astral characters', async () => {
    expect(await parse('greeting=h%C3%A9llo%20%F0%9F%99%82')).toEqual({ greeting: 'héllo 🙂' })
    expect(await parse('%F0%9F%99%82=ok')).toEqual({ '🙂': 'ok' })
  })

  it('round-trips with json_to_query_string, unicode included', async () => {
    const original = { q: 'héllo 🙂', filter: { color: 'red' }, tags: ['a', 'b'] }
    const query = String(await toQueryString.apply(JSON.stringify(original), { arrayFormat: 'index' }))
    expect(await parse(query)).toEqual(original)

    const dotted = String(
      await toQueryString.apply(JSON.stringify(original), { arrayFormat: 'index', nested: 'dot' })
    )
    expect(await parse(dotted, { nested: 'dot' })).toEqual(original)

    // dot nesting still marks arrays with brackets, so auto has to read both
    const mixed = String(
      await toQueryString.apply(JSON.stringify(original), { arrayFormat: 'bracket', nested: 'dot' })
    )
    expect(mixed).toBe('q=h%C3%A9llo%20%F0%9F%99%82&filter.color=red&tags[]=a&tags[]=b')
    expect(await parse(mixed)).toEqual(original)
  })

  it('throws on malformed input', () => {
    expect(() => util.apply('a=%E0%A4%A', {})).toThrow(/percent-encoding/)
    expect(() => util.apply('a=1&a[b]=2', {})).toThrow(/conflicting values/)
  })
})
