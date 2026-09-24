import { describe, it, expect } from 'vitest'
import util from './index'

type Result = { valid: boolean; errors: { path: string; message: string }[] }

const run = async (data: string, schema: unknown) =>
  (await util.apply(data, { schema: typeof schema === 'string' ? schema : JSON.stringify(schema) })) as unknown as Result

const USER_SCHEMA = {
  type: 'object',
  required: ['id', 'email'],
  properties: {
    id: { type: 'integer', minimum: 1 },
    email: { type: 'string', format: 'email' },
    tags: { type: 'array', items: { type: 'string' }, minItems: 1, uniqueItems: true },
  },
  additionalProperties: false,
}

describe('json_schema_validate', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('json_schema_validate')
    expect(util.name).toBe('json schema validate')
    expect(util.category).toBe('Data Formats')
    expect(util.accepts).toEqual(['string', 'json'])
    expect(util.produces).toBe('json')
    expect(util.params.schema.kind).toBe('file')
  })

  it('accepts a schema value loaded from a file just like typed text', async () => {
    // kind 'file' still stores a plain string — loading from disk or typing it
    // must behave identically.
    const res = await run('{"id":1,"email":"ada@example.com"}', {
      type: 'object',
      required: ['id', 'email'],
    })
    expect(res).toEqual({ valid: true, errors: [] })
  })

  it('accepts a document that satisfies the schema', async () => {
    const res = await run('{"id":1,"email":"ada@example.com","tags":["a","b"]}', USER_SCHEMA)
    expect(res).toEqual({ valid: true, errors: [] })
  })

  it('reports missing required properties, bad types and unknown properties', async () => {
    const res = await run('{"id":"1","nope":true}', USER_SCHEMA)
    expect(res.valid).toBe(false)
    expect(res.errors).toContainEqual({ path: '$', message: 'missing required property "email"' })
    expect(res.errors).toContainEqual({ path: '$.id', message: 'expected type integer, got string' })
    expect(res.errors).toContainEqual({
      path: '$.nope',
      message: 'additional property is not allowed',
    })
  })

  it('checks array keywords with nested paths', async () => {
    const res = await run('{"id":1,"email":"a@b.co","tags":["x",1,"x"]}', USER_SCHEMA)
    expect(res.valid).toBe(false)
    expect(res.errors).toContainEqual({ path: '$.tags[1]', message: 'expected type string, got number' })
    expect(res.errors).toContainEqual({ path: '$.tags', message: 'items 0 and 2 are duplicates' })
    const empty = await run('{"id":1,"email":"a@b.co","tags":[]}', USER_SCHEMA)
    expect(empty.errors).toContainEqual({
      path: '$.tags',
      message: 'expected at least 1 items, got 0',
    })
    expect((await run('[1,2,3]', { maxItems: 2 })).errors).toEqual([
      { path: '$', message: 'expected at most 2 items, got 3' },
    ])
    expect((await run('[1,2]', { maxItems: 2 })).valid).toBe(true)
  })

  it('compares uniqueItems by value, not by reference or key order', async () => {
    expect((await run('[{"a":1,"b":2},{"b":2,"a":1}]', { uniqueItems: true })).errors).toEqual([
      { path: '$', message: 'items 0 and 1 are duplicates' },
    ])
    // 1 and "1" and true are three distinct JSON values
    expect((await run('[1,"1",true]', { uniqueItems: true })).valid).toBe(true)
    expect((await run('[[1,2],[1,2]]', { uniqueItems: true })).valid).toBe(false)
    expect((await run('[[1,2],[2,1]]', { uniqueItems: true })).valid).toBe(true)
    expect((await run('[1,1]', { uniqueItems: false })).valid).toBe(true)
  })

  it('validates tuple items and a schema-valued additionalProperties', async () => {
    const tuple = { items: [{ type: 'integer' }, { type: 'string' }] }
    expect((await run('[1,"a"]', tuple)).valid).toBe(true)
    expect((await run('["a",1]', tuple)).errors).toEqual([
      { path: '$[0]', message: 'expected type integer, got string' },
      { path: '$[1]', message: 'expected type string, got number' },
    ])
    // positions past the tuple are unconstrained
    expect((await run('[1,"a",{}]', tuple)).valid).toBe(true)

    const extra = { properties: { a: {} }, additionalProperties: { type: 'number' } }
    expect((await run('{"a":"anything","b":2}', extra)).valid).toBe(true)
    expect((await run('{"a":"anything","b":"x"}', extra)).errors).toEqual([
      { path: '$.b', message: 'expected type number, got string' },
    ])
  })

  it('accepts a list of types and distinguishes integer from number', async () => {
    expect((await run('null', { type: ['string', 'null'] })).valid).toBe(true)
    expect((await run('"s"', { type: ['string', 'null'] })).valid).toBe(true)
    expect((await run('1', { type: ['string', 'null'] })).errors).toEqual([
      { path: '$', message: 'expected type string or null, got number' },
    ])
    expect((await run('1.0', { type: 'integer' })).valid).toBe(true)
    expect((await run('1.5', { type: 'integer' })).valid).toBe(false)
    expect((await run('1.5', { type: 'number' })).valid).toBe(true)
    expect((await run('[]', { type: 'array' })).valid).toBe(true)
    expect((await run('{}', { type: 'array' })).errors[0].message).toBe(
      'expected type array, got object'
    )
  })

  it('counts string length in code points so emoji are not split', async () => {
    const ok = await run('"😀😀"', { type: 'string', maxLength: 2 })
    expect(ok.valid).toBe(true)
    const tooShort = await run('"😀😀"', { type: 'string', minLength: 3 })
    expect(tooShort.errors).toEqual([
      { path: '$', message: 'expected at least 3 characters, got 2' },
    ])
  })

  it('validates enum, const, pattern and formats', async () => {
    expect((await run('"b"', { enum: ['a', 'b'] })).valid).toBe(true)
    expect((await run('"c"', { enum: ['a', 'b'] })).valid).toBe(false)
    expect((await run('42', { const: 42 })).valid).toBe(true)
    expect((await run('43', { const: 42 })).errors[0].message).toBe('expected the constant 42')
    expect((await run('"ab-12"', { type: 'string', pattern: '^[a-z]+-\\d+$' })).valid).toBe(true)
    expect((await run('"nope"', { type: 'string', pattern: '^[a-z]+-\\d+$' })).valid).toBe(false)
    expect((await run('"not-an-email"', { format: 'email' })).errors[0].message).toBe(
      'is not a valid email'
    )
    expect((await run('"550e8400-e29b-41d4-a716-446655440000"', { format: 'uuid' })).valid).toBe(true)
    expect((await run('"2024-03-01T10:00:00Z"', { format: 'date-time' })).valid).toBe(true)
    expect((await run('"999.1.1.1"', { format: 'ipv4' })).valid).toBe(false)
    expect((await run('"https://example.com/x"', { format: 'uri' })).valid).toBe(true)
    expect((await run('"anything"', { format: 'not-a-known-format' })).valid).toBe(true)
  })

  it('validates numeric bounds including the exclusive forms', async () => {
    expect((await run('5', { minimum: 1, maximum: 10 })).valid).toBe(true)
    expect((await run('0', { minimum: 1 })).errors[0].message).toBe('expected >= 1, got 0')
    expect((await run('11', { maximum: 10 })).errors[0].message).toBe('expected <= 10, got 11')
    expect((await run('1', { exclusiveMinimum: 1 })).errors[0].message).toBe('expected > 1, got 1')
    expect((await run('10', { exclusiveMaximum: 10 })).errors[0].message).toBe('expected < 10, got 10')
  })

  it('supports anyOf, allOf, oneOf and not', async () => {
    expect((await run('"x"', { anyOf: [{ type: 'number' }, { type: 'string' }] })).valid).toBe(true)
    expect((await run('true', { anyOf: [{ type: 'number' }, { type: 'string' }] })).errors[0].message)
      .toBe('does not match any schema in anyOf')
    expect((await run('"abc"', { allOf: [{ type: 'string' }, { minLength: 2 }] })).valid).toBe(true)
    expect((await run('"a"', { allOf: [{ type: 'string' }, { minLength: 2 }] })).valid).toBe(false)
    expect((await run('5', { oneOf: [{ type: 'integer' }, { type: 'string' }] })).valid).toBe(true)
    expect((await run('5', { oneOf: [{ type: 'integer' }, { type: 'number' }] })).errors[0].message)
      .toBe('matches 2 schemas in oneOf, expected exactly 1')
    expect((await run('5', { not: { type: 'string' } })).valid).toBe(true)
    expect((await run('"s"', { not: { type: 'string' } })).errors[0].message).toBe(
      'must not match the "not" schema'
    )
  })

  it('resolves local $ref pointers and reports unresolvable ones', async () => {
    const schema = {
      type: 'object',
      properties: { home: { $ref: '#/definitions/address' } },
      definitions: { address: { type: 'object', required: ['city'] } },
    }
    expect((await run('{"home":{"city":"Kyoto"}}', schema)).valid).toBe(true)
    const bad = await run('{"home":{}}', schema)
    expect(bad.errors).toEqual([{ path: '$.home', message: 'missing required property "city"' }])
    const missing = await run('{}', { $ref: '#/definitions/nope' })
    expect(missing.errors[0].message).toBe('cannot resolve $ref "#/definitions/nope"')
  })

  it('follows a recursive $ref through deeply nested data without bailing out', async () => {
    const recursive = {
      type: 'object',
      properties: { value: { type: 'integer' }, child: { $ref: '#' } },
    }
    // 200 levels: deeper than any per-branch $ref budget, but the data is finite
    // so the walk must complete rather than report "$ref nesting is too deep".
    let deep: Record<string, unknown> = { value: 0 }
    for (let i = 1; i <= 200; i++) deep = { value: i, child: deep }
    expect(await run(JSON.stringify(deep), recursive)).toEqual({ valid: true, errors: [] })

    let bad: Record<string, unknown> = { value: 'not an integer' }
    for (let i = 1; i <= 200; i++) bad = { value: i, child: bad }
    const res = await run(JSON.stringify(bad), recursive)
    expect(res.valid).toBe(false)
    expect(res.errors[0].message).toBe('expected type integer, got string')
    expect(res.errors[0].path.endsWith('.child.value')).toBe(true)

    // a schema that recurses without ever consuming data still terminates
    const spin = await run('1', { allOf: [{ $ref: '#' }] })
    expect(spin.errors[0].message).toBe('$ref nesting is too deep')
  })

  it('handles unicode data and quotes non-identifier paths', async () => {
    const schema = {
      type: 'object',
      properties: { '名前': { type: 'string', minLength: 2 }, 'my-key': { type: 'number' } },
    }
    expect((await run('{"名前":"アダ😀","my-key":1}', schema)).valid).toBe(true)
    const res = await run('{"名前":"あ","my-key":"x"}', schema)
    expect(res.errors).toContainEqual({
      path: '$["名前"]',
      message: 'expected at least 2 characters, got 1',
    })
    expect(res.errors).toContainEqual({
      path: '$["my-key"]',
      message: 'expected type number, got string',
    })
  })

  it('treats an empty or missing schema as "anything goes"', async () => {
    expect(await util.apply('{"a":1}', {})).toEqual({ valid: true, errors: [] })
    expect(await util.apply('{"a":1}', { schema: '   ' })).toEqual({ valid: true, errors: [] })
    expect(await util.apply({ a: 1 } as never, { schema: '{"type":"object"}' })).toEqual({
      valid: true,
      errors: [],
    })
  })

  it('never throws on empty input', async () => {
    expect(await util.apply('', { schema: '{"type":"string"}' })).toEqual({
      valid: false,
      errors: [{ path: '$', message: 'no input to validate' }],
    })
  })

  it('throws a clear error on malformed json or a malformed schema', () => {
    expect(() => util.apply('{oops', { schema: '{}' })).toThrow(/invalid JSON input/)
    expect(() => util.apply('{}', { schema: '{oops' })).toThrow(/invalid schema JSON/)
  })
})
