import { describe, it, expect } from 'vitest'
import util from './index'

const DRAFT_07 = 'http://json-schema.org/draft-07/schema#'
const SAMPLE = '{"id":1,"name":"Ada","tags":["core"],"active":true,"score":null,"ratio":1.5}'

describe('json_to_schema', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('json_to_schema')
    expect(util.name).toBe('json to json schema')
    expect(util.category).toBe('Data Formats')
    expect(util.accepts).toEqual(['string', 'json'])
    expect(util.produces).toBe('json')
    expect(Object.keys(util.params).sort()).toEqual(['includeExamples', 'requireAll', 'title'])
  })

  it('generates a draft-07 schema from a realistic sample', async () => {
    const out = await util.apply(SAMPLE, {})
    expect(typeof out).toBe('object')
    expect(out).toEqual({
      $schema: DRAFT_07,
      title: 'Root',
      type: 'object',
      properties: {
        id: { type: 'integer' },
        name: { type: 'string' },
        tags: { type: 'array', items: { type: 'string' } },
        active: { type: 'boolean' },
        score: { type: 'null' },
        ratio: { type: 'number' },
      },
      required: ['id', 'name', 'tags', 'active', 'score', 'ratio'],
    })
  })

  it('returns an empty object for empty input', async () => {
    expect(await util.apply('', {})).toEqual({})
    expect(await util.apply('  \n', {})).toEqual({})
  })

  it('honours title and drops it when blank', async () => {
    const titled = (await util.apply('"hi"', { title: 'Greeting' })) as Record<string, unknown>
    expect(titled).toEqual({ $schema: DRAFT_07, title: 'Greeting', type: 'string' })
    const untitled = (await util.apply('"hi"', { title: '' })) as Record<string, unknown>
    expect(untitled.title).toBeUndefined()
    expect(untitled.type).toBe('string')
  })

  it('omits required when requireAll is off', async () => {
    const on = (await util.apply('{"a":1}', { requireAll: true })) as Record<string, unknown>
    expect(on.required).toEqual(['a'])
    const off = (await util.apply('{"a":1}', { requireAll: false })) as Record<string, unknown>
    expect(off.required).toBeUndefined()
    expect(off.properties).toEqual({ a: { type: 'integer' } })
  })

  it('adds examples only when includeExamples is on', async () => {
    const plain = (await util.apply('{"a":"x"}', {})) as any
    expect(plain.properties.a).toEqual({ type: 'string' })
    const withEx = (await util.apply('{"a":"x","n":[2]}', { includeExamples: true })) as any
    expect(withEx.properties.a).toEqual({ type: 'string', examples: ['x'] })
    expect(withEx.properties.n).toEqual({
      type: 'array',
      items: { type: 'integer', examples: [2] },
    })
  })

  it('merges array members and only requires keys present in every sample', async () => {
    expect(await util.apply('[{"a":1},{"a":2,"b":"x"}]', {})).toEqual({
      $schema: DRAFT_07,
      title: 'Root',
      type: 'array',
      items: {
        type: 'object',
        properties: { a: { type: 'integer' }, b: { type: 'string' } },
        required: ['a'],
      },
    })
  })

  it('widens integer to number and unions mixed scalar arrays', async () => {
    const numeric = (await util.apply('[1,2.5]', {})) as any
    expect(numeric.items).toEqual({ type: 'number' })
    const mixed = (await util.apply('[1,"a"]', {})) as any
    expect(mixed.items).toEqual({ type: ['integer', 'string'] })
    const anyOf = (await util.apply('[{"a":1},"x"]', {})) as any
    expect(anyOf.items).toEqual({
      anyOf: [
        { type: 'object', properties: { a: { type: 'integer' } }, required: ['a'] },
        { type: 'string' },
      ],
    })
  })

  it('handles empty containers', async () => {
    expect(await util.apply('[]', {})).toEqual({
      $schema: DRAFT_07,
      title: 'Root',
      type: 'array',
      items: {},
    })
    expect(await util.apply('{}', {})).toEqual({
      $schema: DRAFT_07,
      title: 'Root',
      type: 'object',
      properties: {},
    })
  })

  it('preserves unicode keys and example values', async () => {
    const out = (await util.apply('{"名前":"アダ😀"}', { includeExamples: true })) as any
    expect(out.properties['名前']).toEqual({ type: 'string', examples: ['アダ😀'] })
    expect(out.required).toEqual(['名前'])
  })

  it('keeps a "__proto__" key as a real property instead of losing it', async () => {
    const out = (await util.apply('{"__proto__":"x","ok":1}', {})) as any
    const props = out.properties as Record<string, unknown>
    expect(Object.keys(props).sort()).toEqual(['__proto__', 'ok'])
    expect(Object.prototype.hasOwnProperty.call(props, '__proto__')).toBe(true)
    expect(props['__proto__']).toEqual({ type: 'string' })
    expect(out.required).toEqual(['__proto__', 'ok'])
    // the schema must survive serialisation with the key intact
    expect(JSON.parse(JSON.stringify(out)).properties['__proto__']).toEqual({ type: 'string' })
    // ...and the prototype must not have been hijacked by the assignment
    expect(Object.getPrototypeOf(props)).toBe(Object.prototype)
  })

  it('accepts a parsed json value from a previous step', async () => {
    const out = (await util.apply({ ok: true } as never, {})) as any
    expect(out.properties).toEqual({ ok: { type: 'boolean' } })
  })

  it('throws a clear error on malformed json', () => {
    expect(() => util.apply('{oops', {})).toThrow(/invalid JSON/)
    expect(() => util.apply('nope', {})).toThrow(/invalid JSON/)
  })
})
