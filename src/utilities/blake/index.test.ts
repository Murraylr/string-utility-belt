import { describe, it, expect } from 'vitest'
import util from './index'
import { textToUint8Array } from '../helpers'

// Digests cross-checked against node's blake2b512/blake2s256, an independent
// RFC 7693 BLAKE2b/BLAKE2s implementation (for the truncated and keyed cases)
// and the blake3-wasm package.
const LONG = 'The quick brown fox jumps over the lazy dog. Pack my box with five dozen liquor jugs.'
const KEY32 = '0123456789abcdef0123456789abcdef'

describe('blake', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('blake')
    expect(util.name).toBe('blake hash')
    expect(util.category).toBe('Hashing')
    expect(util.accepts).toEqual(['string', 'bytes'])
    expect(util.produces).toBe('string')
    expect(util.params.key.kind).toBe('string')
    expect((util.params.algorithm as { default: string }).default).toBe('BLAKE2b-256')
    expect((util.params.key as { default: string }).default).toBe('')
    expect((util.params.output as { default: string }).default).toBe('hex')
  })

  it('defaults to BLAKE2b-256 hex', async () => {
    expect(await util.apply('abc', {})).toBe(
      'bddd813c634239723171ef3fee98579b94964e3bb1cb3e427262c8c068d52319'
    )
  })

  it('supports every algorithm option', async () => {
    expect(await util.apply('abc', { algorithm: 'BLAKE2b-256' })).toBe(
      'bddd813c634239723171ef3fee98579b94964e3bb1cb3e427262c8c068d52319'
    )
    expect(await util.apply('abc', { algorithm: 'BLAKE2b-512' })).toBe(
      'ba80a53f981c4d0d6a2797b69f12f6e94c212f14685ac4b74b12bb6fdbffa2d17d87c5392aab792dc252d5de4533cc9518d38aa8dbf1925ab92386edd4009923'
    )
    expect(await util.apply('abc', { algorithm: 'BLAKE2s-128' })).toBe('aa4938119b1dc7b87cbad0ffd200d0ae')
    expect(await util.apply('abc', { algorithm: 'BLAKE2s-256' })).toBe(
      '508c5e8c327c14e2e1a72ba34eeb452f37458b209ed63a294d999b4c86675982'
    )
    expect(await util.apply('abc', { algorithm: 'BLAKE3-256' })).toBe(
      '6437b3ac38465133ffb63b75273a8db548c558465d79db03fd359c6cd5bd9d85'
    )
  })

  it('produces digests of the advertised width', async () => {
    expect(String(await util.apply('abc', { algorithm: 'BLAKE2s-128' })).length).toBe(32)
    expect(String(await util.apply('abc', { algorithm: 'BLAKE2b-256' })).length).toBe(64)
    expect(String(await util.apply('abc', { algorithm: 'BLAKE2b-512' })).length).toBe(128)
  })

  it('hashes input spanning several compression blocks', async () => {
    // 85 bytes: two BLAKE2s blocks (64 B each), one BLAKE2b block (128 B)
    expect(await util.apply(LONG, {})).toBe(
      'bad4c59f4d418cc0ccf29699e2794e046cb2a6629053f2e31808a439385b064e'
    )
    expect(await util.apply(LONG, { algorithm: 'BLAKE2b-512' })).toBe(
      '35ea49cc2ea23c9f1f1c402cb26ccaf188663b883f1c0c83432786e69901cce5cb93be8cf2487ec350a4ce2586893ad5f9a1162cf0c7a213288b80f4d4226968'
    )
    expect(await util.apply(LONG, { algorithm: 'BLAKE2s-128' })).toBe('aacbf5f87b6c67a913abca892ed6837f')
    expect(await util.apply(LONG, { algorithm: 'BLAKE2s-256' })).toBe(
      '3dccfa635b35210f138d4e8cc62dba008c4c2302f68c6dd2b0b27460ac05eeb5'
    )
    expect(await util.apply(LONG, { algorithm: 'BLAKE3-256' })).toBe(
      '3a8632672c449284a7332be8c48360e7e9048872926ad3cdaecbe8d6846b215b'
    )
    // past BLAKE3's 1 KiB chunk size, so its tree hashing kicks in
    expect(await util.apply('x'.repeat(5000), {})).toBe(
      'a90895877799c6cc11eee87d47a1797980e06dd016e6bd96c23663df57bdbd0e'
    )
  })

  it('keys the hash when a key is supplied', async () => {
    expect(await util.apply('abc', { algorithm: 'BLAKE2b-256', key: 'secret' })).toBe(
      'e23c35713e7249f369b7c6f60291c0af9d6ac0231d80f46e13b1313fe7f4a4d5'
    )
    expect(await util.apply('abc', { algorithm: 'BLAKE2b-512', key: 'secret' })).toBe(
      '204c828c56fbe6dfe80f110efd16649b9baaad573a6fe4a9a3f492857ec46f8f01eb46d3d6b777f014802967b258fdf631947e68e70cbf9054edf69fa3bbb4a8'
    )
    expect(await util.apply('abc', { algorithm: 'BLAKE2s-128', key: 'secret' })).toBe(
      '9af4e6ccbbfafb7c9dbc6088ca27f3da'
    )
    expect(await util.apply('abc', { algorithm: 'BLAKE2s-256', key: 'secret' })).toBe(
      'd7d0d1441d31d042d6c1ef68ce5162e56f3b2a208de82b727b7c30c709b7bff2'
    )
    // BLAKE3 demands a 32-byte key
    expect(await util.apply('abc', { algorithm: 'BLAKE3-256', key: KEY32 })).toBe(
      'd1190deec27dc438906e12070c5098ce46256ad7c3cb8f725eb3402e8c786aab'
    )
    // keying survives multi-block input
    expect(await util.apply(LONG, { algorithm: 'BLAKE2b-256', key: 'secret' })).toBe(
      'da304693fbdf2109aed540114f3469e43933b1f5ba26991adfa7be4c452337b1'
    )
    expect(await util.apply(LONG, { algorithm: 'BLAKE2s-256', key: 'secret' })).toBe(
      '57afc416f8d498d18cafbd72a59b210c62060f36b24e117ac159ab20e4aff26d'
    )
    expect(await util.apply(LONG, { algorithm: 'BLAKE3-256', key: KEY32 })).toBe(
      '43a20bda64dee2192911afa0d47a28afda3005ecce3b64a584a786030123f959'
    )
    // a keyed digest differs from the unkeyed one, and from a different key
    expect(await util.apply('abc', { algorithm: 'BLAKE2b-512', key: 'secret' })).not.toBe(
      await util.apply('abc', { algorithm: 'BLAKE2b-512' })
    )
    expect(await util.apply('abc', { algorithm: 'BLAKE2s-128', key: 'secret' })).not.toBe(
      await util.apply('abc', { algorithm: 'BLAKE2s-128', key: 'other' })
    )
    // an empty key means "unkeyed"
    expect(await util.apply('abc', { algorithm: 'BLAKE2b-256', key: '' })).toBe(
      await util.apply('abc', { algorithm: 'BLAKE2b-256' })
    )
  })

  it('measures the key in UTF-8 bytes, not characters', async () => {
    // 'clé🔑' is 4 characters but 8 bytes
    expect(await util.apply('abc', { algorithm: 'BLAKE2b-256', key: 'clé🔑' })).toBe(
      'c6e62e6040b88b8aed4ff0d198042b5293d40f2f00733e257d901289bcec725d'
    )
    // 32 characters of 2-byte text is a 64-byte key: fine for BLAKE2b…
    expect(String(await util.apply('abc', { algorithm: 'BLAKE2b-256', key: 'é'.repeat(32) }))).toHaveLength(
      64
    )
    // …too long for BLAKE2s
    await expect(
      util.apply('abc', { algorithm: 'BLAKE2s-256', key: 'é'.repeat(32) })
    ).rejects.toThrow(/at most 32 bytes \(got 64\)/)
    // 16 two-byte characters are exactly the 32 bytes BLAKE3 wants; 17 are not
    expect(await util.apply('abc', { algorithm: 'BLAKE3-256', key: 'é'.repeat(16) })).toBe(
      '77c16a810ae937c9791a16163bf9168c4f5ed87ea5d88b3f26bc3809f70dbba5'
    )
    await expect(util.apply('abc', { algorithm: 'BLAKE3-256', key: 'é'.repeat(17) })).rejects.toThrow(
      /exactly 32 bytes \(got 34\)/
    )
  })

  it('supports hex and base64 output', async () => {
    expect(await util.apply('abc', { algorithm: 'BLAKE2b-256', output: 'hex' })).toBe(
      'bddd813c634239723171ef3fee98579b94964e3bb1cb3e427262c8c068d52319'
    )
    expect(await util.apply('abc', { algorithm: 'BLAKE2b-256', output: 'base64' })).toBe(
      'vd2BPGNCOXIxce8/7phXm5SWTjuxyz5CcmLIwGjVIxk='
    )
    expect(await util.apply('abc', { algorithm: 'BLAKE2s-128', output: 'base64' })).toBe(
      'qkk4EZsdx7h8utD/0gDQrg=='
    )
  })

  it('returns empty string for empty input without throwing', async () => {
    expect(await util.apply('', {})).toBe('')
    expect(await util.apply(new Uint8Array([]), {})).toBe('')
    expect(await util.apply('', { algorithm: 'BLAKE3-256', output: 'base64' })).toBe('')
  })

  it('hashes non-ASCII text as UTF-8, keeping astral characters intact', async () => {
    const text = 'héllo 🌍'
    expect(await util.apply(text, {})).toBe(
      'd2414e6fb1bec151ab7495f0df0917485aacf2ddeeda31fbd88f47f7f1d1db97'
    )
    expect(await util.apply(textToUint8Array(text), {})).toBe(await util.apply(text, {}))
    expect(await util.apply('héllo 🌍', {})).not.toBe(await util.apply('héllo ', {}))
  })

  it('accepts raw bytes, including views, and never mutates them', async () => {
    expect(await util.apply(new Uint8Array([97, 98, 99]), {})).toBe(
      'bddd813c634239723171ef3fee98579b94964e3bb1cb3e427262c8c068d52319'
    )
    const view = new Uint8Array([9, 9, 97, 98, 99]).subarray(2)
    expect(await util.apply(view, {})).toBe(
      'bddd813c634239723171ef3fee98579b94964e3bb1cb3e427262c8c068d52319'
    )
    const bytes = new Uint8Array([1, 2, 3, 4, 5])
    const before = Array.from(bytes)
    await util.apply(bytes, { algorithm: 'BLAKE3-256', key: KEY32 })
    expect(Array.from(bytes)).toEqual(before)
  })

  it('throws on over-long or wrong-sized keys and unknown options', async () => {
    await expect(
      util.apply('abc', { algorithm: 'BLAKE2s-256', key: 'x'.repeat(33) })
    ).rejects.toThrow(/at most 32 bytes/)
    await expect(
      util.apply('abc', { algorithm: 'BLAKE2b-256', key: 'x'.repeat(65) })
    ).rejects.toThrow(/at most 64 bytes/)
    await expect(util.apply('abc', { algorithm: 'BLAKE3-256', key: 'short' })).rejects.toThrow(
      /exactly 32 bytes/
    )
    await expect(util.apply('abc', { algorithm: 'BLAKE2b-384' })).rejects.toThrow(/unknown algorithm/)
    await expect(util.apply('abc', { output: 'base64url' })).rejects.toThrow(/unknown output format/)
    // a 64-byte key is the BLAKE2b maximum, not an error
    expect(String(await util.apply('abc', { algorithm: 'BLAKE2b-256', key: 'x'.repeat(64) }))).toBe(
      '1314058cfb6cdfc14fda260fbf0697812b9e6e8dd36b0ad98ed84a99c38e9ff5'
    )
  })
})
