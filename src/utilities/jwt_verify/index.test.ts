import { describe, it, expect, vi } from 'vitest'
import util from './index'

const bytesToB64url = (bytes: Uint8Array) => {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

const b64url = (text: string) => bytesToB64url(new TextEncoder().encode(text))

const HASHES: Record<string, string> = {
  HS256: 'SHA-256',
  HS384: 'SHA-384',
  HS512: 'SHA-512'
}

async function makeToken(
  payload: unknown,
  secret: string | Uint8Array,
  alg = 'HS256',
  header: Record<string, unknown> = {}
) {
  const keyBytes = typeof secret === 'string' ? new TextEncoder().encode(secret) : secret
  const head = b64url(JSON.stringify({ alg, typ: 'JWT', ...header }))
  const body = b64url(JSON.stringify(payload))
  const hash = HASHES[alg]
  if (!hash) return `${head}.${body}.${b64url('unsigned')}`
  const key = await crypto.subtle.importKey(
    'raw',
    keyBytes as BufferSource,
    { name: 'HMAC', hash },
    false,
    ['sign']
  )
  const sig = new Uint8Array(
    await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${head}.${body}`) as BufferSource)
  )
  return `${head}.${body}.${bytesToB64url(sig)}`
}

/**
 * Published HS256 vector (the jwt.io sample token and its default secret).
 * Independently reproducible: HMAC-SHA256("<header>.<payload>", "your-256-bit-secret")
 * base64url-encodes to SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c.
 */
const SAMPLE =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9' +
  '.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ' +
  '.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c'
const SAMPLE_SECRET = 'your-256-bit-secret'

describe('jwt_verify', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('jwt_verify')
    expect(util.name).toBe('jwt verify')
    expect(util.category).toBe('Ciphers')
    expect(util.accepts).toBe('string')
    expect(util.produces).toBe('json')
    expect(Object.keys(util.params)).toEqual(['secret', 'secretFormat', 'checkExpiry'])
    const p = util.params as Record<string, { default?: unknown; options?: string[] }>
    expect(p.secret.default).toBe('')
    expect(p.secretFormat.default).toBe('text')
    expect(p.secretFormat.options).toEqual(['text', 'base64url', 'hex'])
    expect(p.checkExpiry.default).toBe(true)
  })

  it('verifies the published jwt.io HS256 vector', async () => {
    const out = (await util.apply(SAMPLE, { secret: SAMPLE_SECRET })) as Record<string, unknown>
    expect(out).toEqual({
      valid: true,
      algorithm: 'HS256',
      reason: 'signature is valid',
      expired: false
    })
    const wrong = (await util.apply(SAMPLE, { secret: 'secret' })) as Record<string, unknown>
    expect(wrong.valid).toBe(false)
    expect(String(wrong.reason)).toMatch(/signature does not match/)
  })

  it('verifies a good HS256 signature', async () => {
    const token = await makeToken({ sub: 'abc' }, 'topsecret')
    const out = (await util.apply(token, { secret: 'topsecret' })) as Record<string, unknown>
    expect(out.valid).toBe(true)
    expect(out.algorithm).toBe('HS256')
    expect(out.expired).toBe(false)
    expect(out.reason).toBe('signature is valid')
  })

  it('rejects a wrong secret or a tampered payload', async () => {
    const token = await makeToken({ sub: 'abc' }, 'topsecret')
    const wrong = (await util.apply(token, { secret: 'nope' })) as Record<string, unknown>
    expect(wrong.valid).toBe(false)
    expect(String(wrong.reason)).toMatch(/signature does not match/)

    const [h, , s] = token.split('.')
    const tampered = `${h}.${b64url('{"sub":"admin"}')}.${s}`
    const out = (await util.apply(tampered, { secret: 'topsecret' })) as Record<string, unknown>
    expect(out.valid).toBe(false)
  })

  it('verifies HS384 and HS512', async () => {
    const t384 = await makeToken({ a: 1 }, 'k', 'HS384')
    const t512 = await makeToken({ a: 1 }, 'k', 'HS512')
    expect((await util.apply(t384, { secret: 'k' })) as Record<string, unknown>).toMatchObject({
      valid: true,
      algorithm: 'HS384'
    })
    expect((await util.apply(t512, { secret: 'k' })) as Record<string, unknown>).toMatchObject({
      valid: true,
      algorithm: 'HS512'
    })
    // the hash must actually match the header alg
    const mislabelled = `${t384.split('.').slice(0, 2).join('.')}.${t512.split('.')[2]}`
    expect(
      ((await util.apply(mislabelled, { secret: 'k' })) as Record<string, unknown>).valid
    ).toBe(false)
  })

  it('reads the secret as text, hex or base64url', async () => {
    const keyBytes = new Uint8Array([0xde, 0xad, 0xbe, 0xef, 0x01, 0x02, 0x03, 0x04])
    const token = await makeToken({ a: 1 }, keyBytes)
    expect(
      ((await util.apply(token, { secret: 'deadbeef01020304', secretFormat: 'hex' })) as Record<
        string,
        unknown
      >).valid
    ).toBe(true)
    expect(
      ((await util.apply(token, {
        secret: bytesToB64url(keyBytes),
        secretFormat: 'base64url'
      })) as Record<string, unknown>).valid
    ).toBe(true)

    const textToken = await makeToken({ a: 1 }, 'plain-text-secret')
    expect(
      ((await util.apply(textToken, {
        secret: 'plain-text-secret',
        secretFormat: 'text'
      })) as Record<string, unknown>).valid
    ).toBe(true)
  })

  it('accepts a base64url secret written in the standard alphabet', async () => {
    const keyBytes = new Uint8Array([0xfb, 0xff, 0xbe, 0x3f])
    let bin = ''
    for (const b of keyBytes) bin += String.fromCharCode(b)
    const standard = btoa(bin)
    expect(standard).toMatch(/[+/]/)
    const token = await makeToken({ a: 1 }, keyBytes)
    expect(
      ((await util.apply(token, { secret: standard, secretFormat: 'base64url' })) as Record<
        string,
        unknown
      >).valid
    ).toBe(true)
  })

  it('handles unicode secrets and unicode claims', async () => {
    const token = await makeToken({ name: 'Zoë 🚀', city: '東京' }, 'pässwörd 🔑', 'HS256')
    const out = (await util.apply(token, { secret: 'pässwörd 🔑' })) as Record<string, unknown>
    expect(out.valid).toBe(true)
    expect((await util.apply(token, { secret: 'passwörd 🔑' })) as Record<string, unknown>).toMatchObject(
      { valid: false }
    )
  })

  it('honours the checkExpiry option', async () => {
    const expired = await makeToken({ exp: 1000000000 }, 'k')
    const checked = (await util.apply(expired, { secret: 'k', checkExpiry: true })) as Record<
      string,
      unknown
    >
    expect(checked.valid).toBe(false)
    expect(checked.expired).toBe(true)
    expect(String(checked.reason)).toMatch(/expired at 2001-09-09T01:46:40\.000Z/)

    const unchecked = (await util.apply(expired, { secret: 'k', checkExpiry: false })) as Record<
      string,
      unknown
    >
    expect(unchecked.valid).toBe(true)
    expect(unchecked.expired).toBe(true)
    expect(String(unchecked.reason)).toMatch(/expiry checking is off/)

    const notYet = await makeToken({ nbf: 4102444800 }, 'k')
    const early = (await util.apply(notYet, { secret: 'k' })) as Record<string, unknown>
    expect(early.valid).toBe(false)
    expect(String(early.reason)).toMatch(/not valid before 2100-01-01/)
    expect((await util.apply(notYet, { secret: 'k', checkExpiry: false })) as Record<string, unknown>)
      .toMatchObject({ valid: true })
  })

  it('treats the exp instant itself as expired, and nbf as inclusive', async () => {
    const token = await makeToken({ exp: 1700000000, nbf: 1600000000 }, 'k')
    const nbfToken = await makeToken({ nbf: 1700000000 }, 'k')
    try {
      vi.useFakeTimers()
      vi.setSystemTime(new Date(1700000000000))
      expect((await util.apply(token, { secret: 'k' })) as Record<string, unknown>).toMatchObject({
        valid: false,
        expired: true
      })
      // nbf === now is inside the validity window
      expect((await util.apply(nbfToken, { secret: 'k' })) as Record<string, unknown>).toMatchObject(
        { valid: true }
      )
      vi.setSystemTime(new Date(1699999999999))
      expect((await util.apply(token, { secret: 'k' })) as Record<string, unknown>).toMatchObject({
        valid: true,
        expired: false
      })
    } finally {
      vi.useRealTimers()
    }
  })

  it('reports unsupported and unsigned algorithms instead of throwing', async () => {
    const rs = `${b64url('{"alg":"RS256"}')}.${b64url('{"a":1}')}.${b64url('sig')}`
    const rsOut = (await util.apply(rs, { secret: 'k' })) as Record<string, unknown>
    expect(rsOut.valid).toBe(false)
    expect(rsOut.algorithm).toBe('RS256')
    expect(String(rsOut.reason)).toMatch(/unsupported algorithm/)

    const none = `${b64url('{"alg":"none"}')}.${b64url('{"a":1}')}.`
    const noneOut = (await util.apply(none, { secret: 'k' })) as Record<string, unknown>
    expect(noneOut.valid).toBe(false)
    expect(String(noneOut.reason)).toMatch(/unsigned/)
  })

  it('reports malformed tokens through the reason field', async () => {
    const out = (await util.apply('hello world', { secret: 'k' })) as Record<string, unknown>
    expect(out.valid).toBe(false)
    expect(String(out.reason)).toMatch(/expected 3 dot-separated parts/)
    expect(out.algorithm).toBeNull()

    const noAlg = `${b64url('{"typ":"JWT"}')}.${b64url('{"a":1}')}.${b64url('sig')}`
    expect(((await util.apply(noAlg, { secret: 'k' })) as Record<string, unknown>).reason).toMatch(
      /no "alg" field/
    )

    const badHeader = `***.${b64url('{"a":1}')}.${b64url('sig')}`
    expect(((await util.apply(badHeader, { secret: 'k' })) as Record<string, unknown>).reason).toMatch(
      /header is not decodable json/
    )
  })

  it('returns an empty object for empty input', async () => {
    expect(await util.apply('', { secret: 'k' })).toEqual({})
    expect(await util.apply('   ', {})).toEqual({})
  })

  it('throws when the secret is missing or undecodable', async () => {
    const token = await makeToken({ a: 1 }, 'k')
    await expect(util.apply(token, {})).rejects.toThrow(/secret is required/)
    await expect(util.apply(token, { secret: 'zz', secretFormat: 'hex' })).rejects.toThrow(
      /not valid hex/
    )
    await expect(util.apply(token, { secret: 'abc', secretFormat: 'hex' })).rejects.toThrow(
      /odd number of digits/
    )
    await expect(util.apply(token, { secret: '**', secretFormat: 'base64url' })).rejects.toThrow(
      /not valid base64url/
    )
    await expect(util.apply(token, { secret: 'k', secretFormat: 'binary' })).rejects.toThrow(
      /unsupported secret format/
    )
    // a secret that decodes to nothing must be named, not surfaced as a WebCrypto DataError
    await expect(util.apply(token, { secret: '   ', secretFormat: 'hex' })).rejects.toThrow(
      /zero bytes/
    )
    await expect(util.apply(token, { secret: '=', secretFormat: 'base64url' })).rejects.toThrow(
      /zero bytes/
    )
  })
})
