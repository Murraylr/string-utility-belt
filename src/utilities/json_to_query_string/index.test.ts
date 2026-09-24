import { describe, it, expect } from 'vitest'
import util from './index'

describe('json_to_query_string', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('json_to_query_string')
    expect(util.name).toBe('json to query string')
    expect(util.category).toBe('Web & Dev')
    expect(util.accepts).toBe('string')
    expect(util.produces).toBe('string')
    expect(Object.keys(util.params).sort()).toEqual(['arrayFormat', 'encode', 'nested', 'prefix', 'sort'])
  })

  it('builds a query string from a flat object', async () => {
    expect(await util.apply('{"q":"hello world","page":2}', {})).toBe('q=hello%20world&page=2')
    expect(await util.apply('{"a":null,"b":false}', {})).toBe('a=&b=false')
  })

  it('returns empty output for empty input', async () => {
    expect(await util.apply('', {})).toBe('')
    expect(await util.apply('   ', {})).toBe('')
    expect(await util.apply('{}', {})).toBe('')
    expect(await util.apply('{}', { prefix: true })).toBe('')
  })

  it('supports every array format', async () => {
    const json = '{"tags":["a","b"]}'
    expect(await util.apply(json, { arrayFormat: 'repeat' })).toBe('tags=a&tags=b')
    expect(await util.apply(json, { arrayFormat: 'bracket' })).toBe('tags[]=a&tags[]=b')
    expect(await util.apply(json, { arrayFormat: 'comma' })).toBe('tags=a,b')
    expect(await util.apply(json, { arrayFormat: 'index' })).toBe('tags[0]=a&tags[1]=b')
  })

  it('supports every nesting mode', async () => {
    const json = '{"filter":{"color":"red"}}'
    expect(await util.apply(json, { nested: 'bracket' })).toBe('filter[color]=red')
    expect(await util.apply(json, { nested: 'dot' })).toBe('filter.color=red')
    expect(await util.apply(json, { nested: 'json' })).toBe('filter=%7B%22color%22%3A%22red%22%7D')
  })

  it('serialises arrays as json under json nesting', async () => {
    expect(await util.apply('{"a":[1,2],"b":{"c":1}}', { nested: 'json' })).toBe(
      'a=%5B1%2C2%5D&b=%7B%22c%22%3A1%7D'
    )
  })

  it('keeps commas inside values distinct from comma separators', async () => {
    expect(await util.apply('{"a":["x,y","z"]}', { arrayFormat: 'comma' })).toBe('a=x%2Cy,z')
  })

  it('combines nesting with array indices', async () => {
    const json = '{"users":[{"name":"ada"},{"name":"bob"}]}'
    expect(await util.apply(json, { arrayFormat: 'index' })).toBe('users[0][name]=ada&users[1][name]=bob')
    expect(await util.apply(json, { arrayFormat: 'index', nested: 'dot' })).toBe(
      'users.0.name=ada&users.1.name=bob'
    )
    // comma cannot express objects, so it falls back to explicit indices
    expect(await util.apply(json, { arrayFormat: 'comma' })).toBe('users[0][name]=ada&users[1][name]=bob')
  })

  it('honours encode, sort and prefix', async () => {
    expect(await util.apply('{"q":"a b&c"}', { encode: false })).toBe('q=a b&c')
    expect(await util.apply('{"q":"a b&c"}', { encode: true })).toBe('q=a%20b%26c')
    expect(await util.apply('{"b":"1","a":"2"}', { sort: true })).toBe('a=2&b=1')
    expect(await util.apply('{"b":"1","a":"2"}', { sort: false })).toBe('b=1&a=2')
    expect(await util.apply('{"q":"1"}', { prefix: true })).toBe('?q=1')
  })

  it('percent-encodes non-ascii and astral characters', async () => {
    expect(await util.apply('{"greeting":"héllo 🙂"}', {})).toBe('greeting=h%C3%A9llo%20%F0%9F%99%82')
    expect(await util.apply('{"greeting":"héllo 🙂"}', { encode: false })).toBe('greeting=héllo 🙂')
    expect(await util.apply('{"🙂":"ok"}', {})).toBe('%F0%9F%99%82=ok')
  })

  it('accepts an already-parsed object and array roots', async () => {
    expect(await util.apply({ a: '1' }, {})).toBe('a=1')
    expect(await util.apply('["x","y"]', {})).toBe('0=x&1=y')
  })

  it('drops empty containers', async () => {
    expect(await util.apply('{"a":[],"b":{},"c":"1"}', {})).toBe('c=1')
  })

  it('throws on invalid or unsupported input', () => {
    expect(() => util.apply('{oops', {})).toThrow(/invalid JSON/)
    expect(() => util.apply('"just a string"', {})).toThrow(/object or array/)
    expect(() => util.apply('42', {})).toThrow(/object or array/)
  })
})
