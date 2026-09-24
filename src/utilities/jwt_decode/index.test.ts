import { describe, it, expect, vi } from 'vitest'
import util from './index'

const b64url = (text: string) => {
  const bytes = new TextEncoder().encode(text)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

const makeToken = (header: unknown, payload: unknown, signature = 'sig') =>
  `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}.${signature}`

// The canonical HS256 example token (jwt.io); iat 1516239022 = 2018-01-18T01:30:22Z.
const SAMPLE =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9' +
  '.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ' +
  '.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c'

describe('jwt_decode', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('jwt_decode')
    expect(util.name).toBe('jwt decode')
    expect(util.category).toBe('Decoding')
    expect(util.accepts).toBe('string')
    expect(util.produces).toBe('json')
    expect(Object.keys(util.params)).toEqual(['part'])
    const part = util.params.part as { default?: unknown; options?: string[] }
    expect(part.default).toBe('all')
    expect(part.options).toEqual(['all', 'header', 'payload'])
  })

  it('decodes header, payload and signature', async () => {
    const out = (await util.apply(SAMPLE, {})) as Record<string, unknown>
    expect(out.header).toEqual({ alg: 'HS256', typ: 'JWT' })
    expect(out.payload).toEqual({ sub: '1234567890', name: 'John Doe', iat: 1516239022 })
    expect(out.signature).toBe('SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c')
    expect(out.issuedAt).toBe('2018-01-18T01:30:22.000Z')
    expect(out.expiresAt).toBeNull()
    expect(out.notBefore).toBeNull()
    expect(out.isExpired).toBe(false)
    expect(typeof out.payload).toBe('object')
  })

  it('returns real objects, not json strings', async () => {
    const out = (await util.apply(SAMPLE, {})) as Record<string, unknown>
    expect(typeof out).toBe('object')
    expect(Array.isArray(out)).toBe(false)
    expect((out.header as Record<string, unknown>).alg).toBe('HS256')
  })

  it('reports expiry and validity windows as ISO dates', async () => {
    const expired = makeToken(
      { alg: 'HS256', typ: 'JWT' },
      { exp: 1000000000, iat: 999999000, nbf: 999999000 }
    )
    const out = (await util.apply(expired, {})) as Record<string, unknown>
    expect(out.expiresAt).toBe('2001-09-09T01:46:40.000Z')
    expect(out.notBefore).toBe('2001-09-09T01:30:00.000Z')
    expect(out.isExpired).toBe(true)

    const future = makeToken({ alg: 'HS256' }, { exp: 4102444800 })
    const later = (await util.apply(future, {})) as Record<string, unknown>
    expect(later.expiresAt).toBe('2100-01-01T00:00:00.000Z')
    expect(later.isExpired).toBe(false)
  })

  it('treats the exp instant itself as expired (RFC 7519: now must be before exp)', () => {
    const token = makeToken({ alg: 'HS256' }, { exp: 1700000000 })
    try {
      vi.useFakeTimers()
      vi.setSystemTime(new Date(1700000000000))
      expect((util.apply(token, {}) as Record<string, unknown>).isExpired).toBe(true)
      vi.setSystemTime(new Date(1699999999999))
      expect((util.apply(token, {}) as Record<string, unknown>).isExpired).toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })

  it('ignores claims that are not numeric dates instead of reading them as 1970', async () => {
    const junk = makeToken({ alg: 'HS256' }, { exp: '', iat: '   ', nbf: true, sub: 'x' })
    const out = (await util.apply(junk, {})) as Record<string, unknown>
    expect(out.expiresAt).toBeNull()
    expect(out.issuedAt).toBeNull()
    expect(out.notBefore).toBeNull()
    expect(out.isExpired).toBe(false)

    // numeric strings are still honoured
    const stringy = (await util.apply(
      makeToken({ alg: 'HS256' }, { iat: '1516239022' }),
      {}
    )) as Record<string, unknown>
    expect(stringy.issuedAt).toBe('2018-01-18T01:30:22.000Z')
  })

  it('preserves unicode claims including astral characters', async () => {
    const token = makeToken({ alg: 'HS512' }, { name: 'José 🎉', city: '東京' })
    const out = (await util.apply(token, {})) as Record<string, unknown>
    expect(out.payload).toEqual({ name: 'José 🎉', city: '東京' })
  })

  it('narrows the result with the part option', async () => {
    expect(await util.apply(SAMPLE, { part: 'header' })).toEqual({ alg: 'HS256', typ: 'JWT' })
    expect(await util.apply(SAMPLE, { part: 'payload' })).toEqual({
      sub: '1234567890',
      name: 'John Doe',
      iat: 1516239022
    })
    expect(await util.apply(SAMPLE, { part: 'all' })).toHaveProperty('signature')
  })

  it('tolerates a Bearer prefix and surrounding whitespace', async () => {
    const out = (await util.apply(`  Bearer ${SAMPLE}  `, {})) as Record<string, unknown>
    expect(out.header).toEqual({ alg: 'HS256', typ: 'JWT' })
  })

  it('returns an empty object for empty input', async () => {
    expect(await util.apply('', {})).toEqual({})
    expect(await util.apply('   ', { part: 'header' })).toEqual({})
  })

  it('throws clear errors for malformed tokens', () => {
    expect(() => util.apply('not-a-token', {})).toThrow(/expected 3 dot-separated parts/)
    expect(() => util.apply('one.two', {})).toThrow(/expected 3 dot-separated parts/)
    expect(() => util.apply('.abc.sig', {})).toThrow(/must not be empty/)
    expect(() => util.apply(`${b64url('{"alg":"HS256"}')}.***.sig`, {})).toThrow(
      /payload is not valid base64url/
    )
    expect(() => util.apply(`${b64url('nope')}.${b64url('{}')}.sig`, {})).toThrow(
      /header is not valid JSON/
    )
    expect(() => util.apply(`${b64url('[1,2]')}.${b64url('{}')}.sig`, {})).toThrow(
      /header is not a JSON object/
    )
    expect(() => util.apply(SAMPLE, { part: 'claims' })).toThrow(/unsupported part/)
  })

  it('rejects segments in the standard base64 alphabet rather than half-decoding them', () => {
    // btoa of these bytes needs "+" and "/", which a JWT segment may never contain
    let bin = ''
    for (const b of new TextEncoder().encode(JSON.stringify({ a: 'øÿ~', b: '???' }))) {
      bin += String.fromCharCode(b)
    }
    const standard = btoa(bin)
    expect(standard).toMatch(/\//)
    expect(() => util.apply(`${b64url('{"alg":"HS256"}')}.${standard}.sig`, {})).toThrow(
      /payload is not valid base64url/
    )
    // a truncated segment (length % 4 === 1) is not silently accepted either
    expect(() => util.apply(`${b64url('{"alg":"HS256"}')}.${'A'.repeat(5)}.sig`, {})).toThrow(
      /is not valid base64url/
    )
  })
})
