import { describe, it, expect } from 'vitest'
import util from './index'

const SAMPLE =
  '{"id":1,"name":"Ada","tags":["core","dev"],"address":{"city":"London","zip":null},"active":true}'

describe('json_to_typescript', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('json_to_typescript')
    expect(util.name).toBe('json to typescript')
    expect(util.category).toBe('Data Formats')
    expect(util.accepts).toEqual(['string', 'json'])
    expect(util.produces).toBe('string')
    expect(Object.keys(util.params).sort()).toEqual([
      'arrayUnion',
      'optionalNulls',
      'readonlyProps',
      'rootName',
      'style',
    ])
  })

  it('infers interfaces from a realistic sample', async () => {
    expect(await util.apply(SAMPLE, {})).toBe(
      [
        'export interface Root {',
        '  id: number;',
        '  name: string;',
        '  tags: string[];',
        '  address: Address;',
        '  active: boolean;',
        '}',
        '',
        'export interface Address {',
        '  city: string;',
        '  zip?: null;',
        '}',
      ].join('\n')
    )
  })

  it('returns an empty string for empty input', async () => {
    expect(await util.apply('', {})).toBe('')
    expect(await util.apply('   \n ', {})).toBe('')
  })

  it('honours rootName, style and readonlyProps', async () => {
    expect(
      await util.apply('{"id":1}', { rootName: 'User', style: 'type', readonlyProps: true })
    ).toBe('export type User = {\n  readonly id: number;\n};')
    expect(await util.apply('{"id":1}', { rootName: 'User', style: 'interface' })).toBe(
      'export interface User {\n  id: number;\n}'
    )
  })

  it('unions mixed arrays only when arrayUnion is on', async () => {
    expect(await util.apply('{"mixed":[1,"two",true]}', { arrayUnion: true })).toBe(
      'export interface Root {\n  mixed: (number | string | boolean)[];\n}'
    )
    // arrayUnion off must widen, never narrow: `number[]` would be a type that
    // lies about the two non-numeric members of the sample.
    expect(await util.apply('{"mixed":[1,"two",true]}', { arrayUnion: false })).toBe(
      'export interface Root {\n  mixed: unknown[];\n}'
    )
    // homogeneous arrays are unaffected by the flag
    expect(await util.apply('{"n":[1,2]}', { arrayUnion: false })).toBe(
      'export interface Root {\n  n: number[];\n}'
    )
    // and the widening reaches values merged through objects and nested arrays too
    expect(await util.apply('{"rows":[[1],["a"]]}', { arrayUnion: false })).toBe(
      'export interface Root {\n  rows: unknown[][];\n}'
    )
    expect(await util.apply('[{"a":1},{"a":"x"}]', { arrayUnion: false })).toBe(
      'export type Root = RootItem[];\n\nexport interface RootItem {\n  a: unknown;\n}'
    )
  })

  it('parenthesises only top-level unions inside array types', async () => {
    expect(await util.apply('{"rows":[[1],["a"]]}', {})).toBe(
      'export interface Root {\n  rows: (number | string)[][];\n}'
    )
    expect(await util.apply('{"m":[1,[2]]}', {})).toBe(
      'export interface Root {\n  m: (number | number[])[];\n}'
    )
  })

  it('makes nullable properties optional only when optionalNulls is on', async () => {
    expect(await util.apply('{"zip":null,"note":["a",null]}', { optionalNulls: true })).toBe(
      'export interface Root {\n  zip?: null;\n  note: (string | null)[];\n}'
    )
    expect(await util.apply('{"zip":null}', { optionalNulls: false })).toBe(
      'export interface Root {\n  zip: null;\n}'
    )
  })

  it('merges array members and marks missing keys optional', async () => {
    expect(
      await util.apply('[{"id":1,"email":"a@b.co"},{"id":2}]', { rootName: 'Users' })
    ).toBe(
      [
        'export type Users = User[];',
        '',
        'export interface User {',
        '  id: number;',
        '  email?: string;',
        '}',
      ].join('\n')
    )
  })

  it('avoids colliding with the root name for an unsingularisable root', async () => {
    expect(await util.apply('[{"id":1}]', {})).toBe(
      'export type Root = RootItem[];\n\nexport interface RootItem {\n  id: number;\n}'
    )
  })

  it('keeps unicode keys intact and quotes invalid identifiers', async () => {
    const out = await util.apply('{"名前":"アダ😀","my-key":1,"🚀":true}', {})
    expect(out).toBe(
      [
        'export interface Root {',
        '  名前: string;',
        "  'my-key': number;",
        "  '🚀': boolean;",
        '}',
      ].join('\n')
    )
    // the astral key survives as one code point, not two broken halves
    expect(Array.from(String(out)).filter((c) => c === '🚀')).toHaveLength(1)
  })

  it('handles empty containers and primitive roots', async () => {
    expect(await util.apply('{}', {})).toBe('export interface Root {}')
    expect(await util.apply('{"list":[],"meta":{}}', {})).toBe(
      'export interface Root {\n  list: unknown[];\n  meta: Meta;\n}\n\nexport interface Meta {}'
    )
    expect(await util.apply('"hello"', {})).toBe('export type Root = string;')
    expect(await util.apply('[1,2]', {})).toBe('export type Root = number[];')
  })

  it('reuses an identical shape and renames a conflicting one', async () => {
    const reused = await util.apply('{"user":{"id":1},"User":{"id":2}}', {})
    expect(reused).toBe(
      [
        'export interface Root {',
        '  user: User;',
        '  User: User;',
        '}',
        '',
        'export interface User {',
        '  id: number;',
        '}',
      ].join('\n')
    )
    const renamed = String(await util.apply('{"user":{"id":1},"User":{"name":"x"}}', {}))
    expect(renamed).toContain('export interface User {')
    expect(renamed).toContain('export interface User2 {')
  })

  it('emits a "__proto__" key rather than swallowing it', async () => {
    expect(await util.apply('{"__proto__":{"a":1},"ok":2}', {})).toBe(
      [
        'export interface Root {',
        '  __proto__: Proto;',
        '  ok: number;',
        '}',
        '',
        'export interface Proto {',
        '  a: number;',
        '}',
      ].join('\n')
    )
  })

  it('accepts a parsed json value from a previous step', async () => {
    expect(await util.apply({ ok: true } as never, {})).toBe(
      'export interface Root {\n  ok: boolean;\n}'
    )
  })

  it('throws a clear error on malformed json', () => {
    expect(() => util.apply('{oops', {})).toThrow(/invalid JSON/)
    expect(() => util.apply('[1,', {})).toThrow(/invalid JSON/)
  })
})
