import { describe, it, expect } from 'vitest'
import util from './index'
import { textToUint8Array } from '../helpers'

// FIPS 202 / Keccak test vectors, cross-checked against node's built-in
// sha3-* digests and an independent Keccak-f[1600] sponge.
const LONG = 'The quick brown fox jumps over the lazy dog. Pack my box with five dozen liquor jugs.'

describe('sha3', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('sha3')
    expect(util.name).toBe('sha3 / keccak')
    expect(util.category).toBe('Hashing')
    expect(util.accepts).toEqual(['string', 'bytes'])
    expect(util.produces).toBe('string')
    expect(util.params.algorithm.kind).toBe('select')
    expect((util.params.algorithm as { default: string }).default).toBe('SHA3-256')
    expect((util.params.output as { default: string }).default).toBe('hex')
  })

  it('defaults to SHA3-256 hex', async () => {
    expect(await util.apply('abc', {})).toBe(
      '3a985da74fe225b2045c172d6bd390bd855f086e3e9d525b46bfe24511431532'
    )
  })

  it('hashes a realistic sentence', async () => {
    expect(await util.apply('The quick brown fox jumps over the lazy dog', {})).toBe(
      '69070dda01975c8c120c3aada1b282394e7f032fa9cf32f4cb2259a0897dfc04'
    )
  })

  it('supports every SHA-3 width', async () => {
    expect(await util.apply('abc', { algorithm: 'SHA3-224' })).toBe(
      'e642824c3f8cf24ad09234ee7d3c766fc9a3a5168d0c94ad73b46fdf'
    )
    expect(await util.apply('abc', { algorithm: 'SHA3-256' })).toBe(
      '3a985da74fe225b2045c172d6bd390bd855f086e3e9d525b46bfe24511431532'
    )
    expect(await util.apply('abc', { algorithm: 'SHA3-384' })).toBe(
      'ec01498288516fc926459f58e2c6ad8df9b473cb0fc08c2596da7cf0e49be4b298d88cea927ac7f539f1edf228376d25'
    )
    expect(await util.apply('abc', { algorithm: 'SHA3-512' })).toBe(
      'b751850b1a57168a5693cd924b6b096e08f621827444f70d884f5d0240d2712e10e116e9192af3c91a7ec57647e3934057340b4cf408d5a56592f8274eec53f0'
    )
  })

  it('supports every Keccak width', async () => {
    expect(await util.apply('abc', { algorithm: 'Keccak-224' })).toBe(
      'c30411768506ebe1c2871b1ee2e87d38df342317300a9b97a95ec6a8'
    )
    // the Ethereum digest — proof Keccak is not silently aliased to SHA-3
    expect(await util.apply('abc', { algorithm: 'Keccak-256' })).toBe(
      '4e03657aea45a94fc7d47ba826c8d667c0d1e6e33a64a036ec44f58fa12d6c45'
    )
    expect(await util.apply('abc', { algorithm: 'Keccak-384' })).toBe(
      'f7df1165f033337be098e7d288ad6a2f74409d7a60b49c36642218de161b1f99f8c681e4afaf31a34db29fb763e3c28e'
    )
    expect(await util.apply('abc', { algorithm: 'Keccak-512' })).toBe(
      '18587dc2ea106b9a1563e32b3312421ca164c7f1f07bc922a9c83d77cea3a1e5d0c69910739025372dc14ac9642629379540c17e2a65b19d77aa511a9d00bb96'
    )
    expect(await util.apply('abc', { algorithm: 'Keccak-256' })).not.toBe(
      await util.apply('abc', { algorithm: 'SHA3-256' })
    )
  })

  it('absorbs input longer than the sponge rate', async () => {
    // 85 bytes: more than one SHA3-512 block (72 bytes), less than one SHA3-256 block
    expect(await util.apply(LONG, {})).toBe(
      '114833747db4c1832c55288f6404901e4afd943d8b9b24cc5d8db4a284482b70'
    )
    expect(await util.apply(LONG, { algorithm: 'SHA3-512' })).toBe(
      '7a4b9809b55e4f6f6574e00ec73f25cb9c175496e78924e523b79e28b965868b465a0c3746e462a3b6b42d39582b6360320ba3d4a265d9e0b34f3b64311b212d'
    )
    expect(await util.apply(LONG, { algorithm: 'Keccak-256' })).toBe(
      'ed44bcbc357f0b856913c91d9e9ce37be0337a5a5d98043c8c6652961291e2cb'
    )
    expect(await util.apply(LONG, { algorithm: 'Keccak-512' })).toBe(
      '5dc970ba3990d0a44e5f7c7cebcbee387a2006e3baa4b617f0594fca1c78b45b97dd2388e3906d388826b8777396a58ca6e5a6f9e61f95c3a7452cdee0d59e09'
    )
    // many blocks
    expect(await util.apply('x'.repeat(5000), {})).toBe(
      'ea473ba6eda314022fe616a8a75643885d25549f6770d4f4273065977946a9fd'
    )
    expect(await util.apply('x'.repeat(5000), { algorithm: 'Keccak-256' })).toBe(
      '8e118c4727ea0a3254e2a4eeccc890fb0c70b2e5acd6d98647602a8e73912c5a'
    )
  })

  it('supports hex, base64 and base64url output', async () => {
    expect(await util.apply('abc', { algorithm: 'SHA3-256', output: 'hex' })).toBe(
      '3a985da74fe225b2045c172d6bd390bd855f086e3e9d525b46bfe24511431532'
    )
    expect(await util.apply('abc', { algorithm: 'SHA3-256', output: 'base64' })).toBe(
      'Ophdp0/iJbIEXBcta9OQvYVfCG4+nVJbRr/iRRFDFTI='
    )
    expect(await util.apply('abc', { algorithm: 'SHA3-256', output: 'base64url' })).toBe(
      'Ophdp0_iJbIEXBcta9OQvYVfCG4-nVJbRr_iRRFDFTI'
    )
    // base64url is unpadded and free of + and /
    const urlSafe = String(await util.apply('abc', { algorithm: 'SHA3-224', output: 'base64url' }))
    expect(urlSafe).toBe('5kKCTD-M8krQkjTufTx2b8mjpRaNDJStc7Rv3w')
    expect(urlSafe).not.toMatch(/[+/=]/)
    // padded base64 of the same 28-byte digest
    expect(await util.apply('abc', { algorithm: 'SHA3-224', output: 'base64' })).toBe(
      '5kKCTD+M8krQkjTufTx2b8mjpRaNDJStc7Rv3w=='
    )
  })

  it('returns empty string for empty input without throwing', async () => {
    expect(await util.apply('', {})).toBe('')
    expect(await util.apply(new Uint8Array([]), {})).toBe('')
    expect(await util.apply('', { algorithm: 'Keccak-512', output: 'base64' })).toBe('')
  })

  it('hashes non-ASCII text as UTF-8, keeping astral characters intact', async () => {
    const text = 'héllo 🌍'
    expect(await util.apply(text, {})).toBe(
      '841e8402472cf441638e7e30fa94f85734e49e5cfeed1a605e30aff831d6a664'
    )
    // identical to hashing the UTF-8 bytes of the same text
    expect(await util.apply(textToUint8Array(text), {})).toBe(await util.apply(text, {}))
    // the emoji is not mangled into lone surrogates
    expect(await util.apply('héllo 🌍', {})).not.toBe(await util.apply('héllo ', {}))
  })

  it('accepts raw bytes, including views, and never mutates them', async () => {
    expect(await util.apply(new Uint8Array([97, 98, 99]), {})).toBe(
      '3a985da74fe225b2045c172d6bd390bd855f086e3e9d525b46bfe24511431532'
    )
    // a subarray view is hashed from its own offset, not the whole buffer
    const view = new Uint8Array([9, 9, 97, 98, 99]).subarray(2)
    expect(await util.apply(view, {})).toBe(
      '3a985da74fe225b2045c172d6bd390bd855f086e3e9d525b46bfe24511431532'
    )
    const bytes = new Uint8Array([1, 2, 3, 4, 5])
    const before = Array.from(bytes)
    await util.apply(bytes, { algorithm: 'Keccak-512' })
    expect(Array.from(bytes)).toEqual(before)
  })

  it('throws on an unknown algorithm or output format', async () => {
    await expect(util.apply('abc', { algorithm: 'SHA3-999' })).rejects.toThrow(/unknown algorithm/)
    await expect(util.apply('abc', { algorithm: 'SHA-256' })).rejects.toThrow(/unknown algorithm/)
    await expect(util.apply('abc', { output: 'base32' })).rejects.toThrow(/unknown output format/)
  })
})
