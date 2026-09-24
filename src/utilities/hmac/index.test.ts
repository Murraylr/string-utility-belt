import { describe, it, expect } from 'vitest'
import util from './index'
import { textToUint8Array } from '../helpers'

const FOX = 'The quick brown fox jumps over the lazy dog'
const FOX_SHA256 = 'f7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8'

describe('hmac', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('hmac')
    expect(util.name).toBe('hmac')
    expect(util.category).toBe('Hashing')
    expect(util.accepts).toEqual(['string', 'bytes'])
    expect(util.produces).toBe('string')
    expect(Object.keys(util.params).sort()).toEqual(['algorithm', 'key', 'keyFormat', 'output'])
  })

  it('signs the classic vector with defaults', async () => {
    expect(await util.apply(FOX, { key: 'key' })).toBe(FOX_SHA256)
  })

  it('supports every algorithm option', async () => {
    expect(await util.apply(FOX, { key: 'key', algorithm: 'SHA-1' }))
      .toBe('de7c9b85b8b78aa6bc8a7a36f70a90701c9db4d9')
    expect(await util.apply(FOX, { key: 'key', algorithm: 'SHA-256' })).toBe(FOX_SHA256)
    expect(await util.apply(FOX, { key: 'key', algorithm: 'SHA-384' })).toBe(
      'd7f4727e2c0b39ae0f1e40cc96f60242d5b7801841cea6fc592c5d3e1ae50700582a96cf35e1e554995fe4e03381c237'
    )
    expect(await util.apply(FOX, { key: 'key', algorithm: 'SHA-512' })).toBe(
      'b42af09057bac1e2d41708e48a902e09b5ff7f12ab428a4fe86653c73dd248fb82f948a549f7b791a5b41915ee4d1ec3935357e4e2317250d0372afa2ebeeb3a'
    )
  })

  it('supports every output encoding', async () => {
    expect(await util.apply(FOX, { key: 'key', output: 'hex' })).toBe(FOX_SHA256)
    expect(await util.apply(FOX, { key: 'key', output: 'base64' }))
      .toBe('97yD9DBThCSxMpjmqm+xQ+9NWaFJRhdZl0edvC0aPNg=')
    expect(await util.apply(FOX, { key: 'key', output: 'base64url' }))
      .toBe('97yD9DBThCSxMpjmqm-xQ-9NWaFJRhdZl0edvC0aPNg')
  })

  it('supports every key format', async () => {
    // 'key' expressed as text, hex and base64 must all produce the same digest
    expect(await util.apply(FOX, { key: 'key', keyFormat: 'text' })).toBe(FOX_SHA256)
    expect(await util.apply(FOX, { key: '6b6579', keyFormat: 'hex' })).toBe(FOX_SHA256)
    expect(await util.apply(FOX, { key: 'a2V5', keyFormat: 'base64' })).toBe(FOX_SHA256)
    // hex keys may be written with 0x / separators, and in either case
    expect(await util.apply(FOX, { key: '0x6b:65:79', keyFormat: 'hex' })).toBe(FOX_SHA256)
    expect(await util.apply(FOX, { key: '6B6579', keyFormat: 'hex' })).toBe(FOX_SHA256)
  })

  it('accepts a base64url key with the url alphabet and no padding', async () => {
    // key bytes fb ef ff be ef: '++//vu8=' in standard base64, '--__vu8' in
    // base64url. Both spellings must yield the same digest.
    const expected = '3c192bc483515df620063abef64cc3cfd32018cb0b3327264e6be79201b3f493'
    expect(await util.apply(FOX, { key: '++//vu8=', keyFormat: 'base64' })).toBe(expected)
    expect(await util.apply(FOX, { key: '--__vu8', keyFormat: 'base64' })).toBe(expected)
  })

  it('matches RFC 4231 test cases', async () => {
    // case 1: 20-byte key
    expect(await util.apply('Hi There', { key: '0b'.repeat(20), keyFormat: 'hex', algorithm: 'SHA-256' }))
      .toBe('b0344c61d8db38535ca8afceaf0bf12b881dc200c9833da726e9376c2e32cff7')
    // case 2: short text key
    expect(await util.apply('what do ya want for nothing?', { key: 'Jefe' }))
      .toBe('5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843')
    // case 6: 131-byte key, longer than the SHA-256 block size, so it must be
    // hashed down rather than truncated or zero-padded
    expect(
      await util.apply('Test Using Larger Than Block-Size Key - Hash Key First', {
        key: 'aa'.repeat(131),
        keyFormat: 'hex'
      })
    ).toBe('60e431591ee0b67f0d8a26aacbf5b77f8e0bc6213728c5140546040f0ee37f54')
  })

  it('signs empty input without throwing', async () => {
    expect(await util.apply('', { key: 'key' }))
      .toBe('5d5d139563c95b5967b9bd9a8c9b233a9dedb45072794cd232dc1b74832607d0')
    expect(await util.apply(new Uint8Array([]), { key: 'key' }))
      .toBe('5d5d139563c95b5967b9bd9a8c9b233a9dedb45072794cd232dc1b74832607d0')
  })

  it('handles unicode keys and astral messages', async () => {
    expect(await util.apply('\u{1F510} café', { key: 'clé' }))
      .toBe('4d3d5af04ba31d48e4168578da10d45c9162eda12dfed03835520187ead607b3')
  })

  it('accepts byte input identically to string input', async () => {
    expect(await util.apply(textToUint8Array(FOX), { key: 'key' })).toBe(FOX_SHA256)
  })

  it('throws a clear error when the key is missing', async () => {
    await expect(util.apply(FOX, {})).rejects.toThrow('hmac requires a key')
    await expect(util.apply(FOX, { key: '', keyFormat: 'hex' })).rejects.toThrow('hmac requires a key')
  })

  it('throws on malformed keys and unknown options', async () => {
    await expect(util.apply(FOX, { key: 'zz', keyFormat: 'hex' })).rejects.toThrow('not valid hex')
    await expect(util.apply(FOX, { key: 'abc', keyFormat: 'hex' })).rejects.toThrow('even number of digits')
    await expect(util.apply(FOX, { key: '!!!!', keyFormat: 'base64' })).rejects.toThrow('not valid base64')
    // a base64 body of 4n+1 chars cannot decode to whole bytes
    await expect(util.apply(FOX, { key: 'a2V5Z', keyFormat: 'base64' })).rejects.toThrow('not valid base64')
    await expect(util.apply(FOX, { key: 'key', algorithm: 'MD5' })).rejects.toThrow('unsupported hmac algorithm')
    await expect(util.apply(FOX, { key: 'key', output: 'base32' })).rejects.toThrow('unsupported hmac output')
  })
})
