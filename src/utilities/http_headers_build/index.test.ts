import { describe, it, expect } from 'vitest'
import util from './index'
import parseUtil from '../http_headers_parse/index'

const run = async (input: unknown, params: Record<string, unknown> = {}) =>
  (await util.apply(input as any, params)) as string

describe('http_headers_build', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('http_headers_build')
    expect(util.name).toBe('json to http headers')
    expect(util.category).toBe('Web & Dev')
    expect(util.accepts).toBe('json')
    expect(util.produces).toBe('string')
    expect(Object.keys(util.params).sort()).toEqual(['canonicalCase', 'eol'])
  })

  it('builds a request block with a start line and CRLF endings', async () => {
    const out = await run({
      method: 'get',
      path: '/api/users?page=2',
      headers: { host: 'example.com', 'user-agent': 'curl/8.4.0' }
    })
    expect(out).toBe('GET /api/users?page=2 HTTP/1.1\r\nHost: example.com\r\nUser-Agent: curl/8.4.0')
  })

  it('supports lf endings and raw casing', async () => {
    const headers = { 'content-type': 'application/json', 'x-request-id': 'abc' }
    expect(await run({ headers }, { eol: 'lf' })).toBe('Content-Type: application/json\nX-Request-Id: abc')
    expect(await run({ headers }, { eol: 'lf', canonicalCase: false })).toBe(
      'content-type: application/json\nx-request-id: abc'
    )
  })

  it('canonicalises awkward header names', async () => {
    const out = await run({ headers: { etag: '"v1"', 'www-authenticate': 'Basic realm="x"', te: 'trailers' } }, { eol: 'lf' })
    expect(out).toBe('ETag: "v1"\nWWW-Authenticate: Basic realm="x"\nTE: trailers')
  })

  it('canonicalises header names that collide with Object.prototype members', async () => {
    // `constructor` and `__proto__` are legal HTTP tokens; an inherited lookup
    // used to emit "function Object() { [native code] }" as the header name
    // computed keys (like JSON.parse) create real own properties, unlike `__proto__: v`
    const headers = { constructor: 'x', ['__proto__']: 'y' }
    expect(await run({ headers }, { eol: 'lf' })).toBe('Constructor: x\n__proto__: y')
  })

  it('leaves HTTP/2 pseudo-headers lowercase and colon-prefixed', async () => {
    expect(await run({ headers: { ':method': 'GET', ':authority': 'api.test' } }, { eol: 'lf' })).toBe(
      ':method: GET\n:authority: api.test'
    )
  })

  it('lets edited method/status win over a stale start line', async () => {
    expect(
      await run(
        { startLine: 'GET /old HTTP/1.1', method: 'POST', path: '/new', httpVersion: 'HTTP/1.1', headers: {} },
        { eol: 'lf' }
      )
    ).toBe('POST /new HTTP/1.1')
    // and the start line is still the fallback when there are no structured fields
    expect(await run({ startLine: 'GET /x HTTP/2', headers: {} }, { eol: 'lf' })).toBe('GET /x HTTP/2')
    // a start line with no version does not gain one
    expect(await run({ startLine: 'GET /x', method: 'GET', path: '/x', headers: {} }, { eol: 'lf' })).toBe('GET /x')
  })

  it('expands array values into repeated headers and builds a status line', async () => {
    const out = await run({ status: 404, headers: { 'set-cookie': ['a=1', 'b=2'] } }, { eol: 'lf' })
    expect(out).toBe('HTTP/1.1 404 Not Found\nSet-Cookie: a=1\nSet-Cookie: b=2')
    expect(await run({ status: 200, statusText: 'Totally Fine', headers: {} }, { eol: 'lf' })).toBe(
      'HTTP/1.1 200 Totally Fine'
    )
  })

  it('accepts a bare header map and an array of pairs', async () => {
    expect(await run({ 'content-type': 'text/plain' }, { eol: 'lf' })).toBe('Content-Type: text/plain')
    expect(await run([['x-a', '1'], { name: 'x-b', value: 2 }, 'x-c: 3'], { eol: 'lf' })).toBe(
      'X-A: 1\nX-B: 2\nX-C: 3'
    )
  })

  it('preserves non-ASCII values', async () => {
    expect(await run({ headers: { 'x-title': 'café ☕ 😀' } }, { eol: 'lf' })).toBe('X-Title: café ☕ 😀')
  })

  it('returns empty output for empty input', async () => {
    expect(await run('')).toBe('')
    expect(await run({})).toBe('')
  })

  it('throws on non-JSON input, bad names and injected line breaks', async () => {
    expect(() => util.apply('definitely not json' as any, {})).toThrow(/expected JSON/)
    expect(() => util.apply({ headers: { 'bad name': 'x' } } as any, {})).toThrow(/invalid header name/)
    expect(() => util.apply({ headers: { 'x-a': 'a\r\nX-Evil: 1' } } as any, {})).toThrow(/line breaks/)
    expect(() => util.apply({ headers: { 'x-a': { nested: true } } } as any, {})).toThrow(/non-scalar/)
  })

  it('round-trips with http_headers_parse, including unicode', async () => {
    const original = [
      'HTTP/1.1 200 OK',
      'Content-Type: text/html; charset=utf-8',
      'Set-Cookie: a=1',
      'Set-Cookie: b=2',
      'X-Title: café ☕ 😀'
    ].join('\r\n')

    const parsed = await parseUtil.apply(original, {})
    const rebuilt = await run(parsed)
    expect(rebuilt).toBe(original)
    expect(await parseUtil.apply(rebuilt, {})).toEqual(parsed)
  })
})
