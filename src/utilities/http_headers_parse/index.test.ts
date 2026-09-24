import { describe, it, expect } from 'vitest'
import util from './index'

const run = async (input: string, params: Record<string, unknown> = {}) =>
  (await util.apply(input, params)) as Record<string, any>

const REQUEST = [
  'GET /api/users?page=2 HTTP/1.1',
  'Host: example.com',
  'User-Agent: curl/8.4.0',
  'Accept: */*'
].join('\r\n')

const RESPONSE = [
  'HTTP/1.1 404 Not Found',
  'Content-Type: text/html; charset=utf-8',
  'Set-Cookie: a=1; Path=/',
  'Set-Cookie: b=2; Path=/'
].join('\n')

describe('http_headers_parse', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('http_headers_parse')
    expect(util.name).toBe('http headers to json')
    expect(util.category).toBe('Web & Dev')
    expect(util.accepts).toBe('string')
    expect(util.produces).toEqual(['json', 'string'])
    expect(Object.keys(util.params).sort()).toEqual(['indent', 'lowercaseNames'])
  })

  it('parses a request block with its start line', async () => {
    const out = await run(REQUEST)
    expect(out.startLine).toBe('GET /api/users?page=2 HTTP/1.1')
    expect(out.method).toBe('GET')
    expect(out.path).toBe('/api/users?page=2')
    expect(out.httpVersion).toBe('HTTP/1.1')
    expect(out.headers).toEqual({
      host: 'example.com',
      'user-agent': 'curl/8.4.0',
      accept: '*/*'
    })
  })

  it('parses a response start line and folds repeated headers into arrays', async () => {
    const out = await run(RESPONSE)
    expect(out.status).toBe(404)
    expect(out.statusText).toBe('Not Found')
    expect(out.httpVersion).toBe('HTTP/1.1')
    expect(out.headers['set-cookie']).toEqual(['a=1; Path=/', 'b=2; Path=/'])
    expect(out.headers['content-type']).toBe('text/html; charset=utf-8')
  })

  it('parses a bare header block with no start line', async () => {
    const out = await run('Accept: application/json\nAuthorization: Bearer abc')
    expect(out.startLine).toBeUndefined()
    expect(out.method).toBeUndefined()
    expect(out.headers).toEqual({ accept: 'application/json', authorization: 'Bearer abc' })
  })

  it('keeps original casing when lowercaseNames is false', async () => {
    const out = await run(REQUEST, { lowercaseNames: false })
    expect(Object.keys(out.headers)).toEqual(['Host', 'User-Agent', 'Accept'])
    expect(out.headers.Host).toBe('example.com')
  })

  it('unfolds obs-fold continuation lines and stops at the blank line before a body', async () => {
    const out = await run('POST /x HTTP/1.1\nX-Long: first\n\tsecond\nHost: e.com\n\n{"a":1}')
    expect(out.headers['x-long']).toBe('first second')
    expect(out.headers).toEqual({ 'x-long': 'first second', host: 'e.com' })
  })

  it('parses HTTP/2 pseudo-headers, whose name owns the leading colon', async () => {
    const out = await run(':method: GET\n:path: /x?a=1\n:authority: api.test\naccept: */*')
    expect(out.headers).toEqual({
      ':method': 'GET',
      ':path': '/x?a=1',
      ':authority': 'api.test',
      accept: '*/*'
    })
  })

  it('keeps a request line that carries no protocol version', async () => {
    const out = await run('GET /x\nHost: a')
    expect(out.startLine).toBe('GET /x')
    expect(out.method).toBe('GET')
    expect(out.path).toBe('/x')
    expect(out.httpVersion).toBeUndefined()
  })

  it('preserves non-ASCII header values', async () => {
    const out = await run('X-Title: café ☕ 😀 — ok')
    expect(out.headers['x-title']).toBe('café ☕ 😀 — ok')
  })

  it('returns an empty header set for empty input', async () => {
    expect(await util.apply('', {})).toEqual({ headers: {} })
    expect(await util.apply('   \r\n  ', {})).toEqual({ headers: {} })
  })

  it('honours the indent param by emitting pre-formatted json text', async () => {
    const compact = await util.apply(REQUEST, { indent: 0 })
    expect(typeof compact).toBe('string')
    expect(compact as string).not.toContain('\n')
    expect(JSON.parse(compact as string).method).toBe('GET')

    const wide = (await util.apply(REQUEST, { indent: 4 })) as string
    expect(wide).toContain('\n    "startLine"')

    // the default (2) stays a structured value for downstream steps
    expect(typeof (await util.apply(REQUEST, { indent: 2 }))).toBe('object')
  })

  it('throws on malformed header lines', async () => {
    expect(() => util.apply('Host: ok\nthis line has no colon', {})).toThrow(/malformed header line/)
    expect(() => util.apply('X Bad Name: value', {})).toThrow(/invalid header name/)
    // a lone leading colon is a pseudo-header with no separator, not a header
    expect(() => util.apply(': value', {})).toThrow(/malformed header line/)
  })
})

describe('http_headers_parse — attacker-sized input', () => {
  // unfolding trimmed the previous line with /[ \t]+$/, quadratic on a long run of
  // spaces that does not reach the end of the line (200k spaces took ~25 s)
  it('unfolds a line holding a huge inner run of spaces in linear time', async () => {
    const t0 = performance.now()
    const out = await run('A: b' + ' '.repeat(200_000) + 'c\n d')
    expect(performance.now() - t0).toBeLessThan(1500)
    expect(JSON.stringify(out)).toContain('c d')
  })
})
