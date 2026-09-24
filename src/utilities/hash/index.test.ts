import { describe, it, expect } from 'vitest'
import util from './index'

describe('hash', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('hash')
    expect(util.name).toBe('hash')
    expect(util.category).toBe('Hashing')
    expect(util.accepts).toEqual(['string', 'bytes'])
    expect(util.produces).toBe('string')
    expect(util.params.algo).toMatchObject({ options: ['SHA-1', 'SHA-256', 'SHA-384', 'SHA-512'] })
    expect(util.params.algo.default).toBe('SHA-256')
  })

  it('computes SHA-1 hash', async () => {
    const out = await util.apply('abc', { algo: 'SHA-1' })
    expect(out).toBe('a9993e364706816aba3e25717850c26c9cd0d89d')
  })

  it('computes SHA-512 hash', async () => {
    const out = await util.apply('abc', { algo: 'SHA-512' })
    expect(out).toBe(
      'ddaf35a193617abacc417349ae20413112e6fa4e89a97ea20a9eeee64b55d39a' +
      '2192992a274fc1a836ba3c23a3feebbd454d4423643ce80e2a9ac94fa54ca49f'
    )
  })

  it('computes SHA-256 hash', async () => {
    const out = await util.apply('abc', { algo: 'SHA-256' })
    expect(out).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  })

  it('computes SHA-384 hash', async () => {
    const out = await util.apply('abc', { algo: 'SHA-384' })
    expect(out).toBe('cb00753f45a35e8bb5a03d699ac65007272c32ab0eded1631a8b605a43ff5bed8086072ba1e7cc2358baeca134c825a7')
  })

  it('hashes empty string', async () => {
    const out = await util.apply('', { algo: 'SHA-256' })
    expect(out).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
  })

  it('defaults to SHA-256 when algo is omitted', async () => {
    const out = await util.apply('abc', {})
    expect(out).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  })

  it('returns lowercase hex string', async () => {
    const out = await util.apply('test', { algo: 'SHA-256' })
    expect(out).toMatch(/^[0-9a-f]{64}$/)
  })

  it('hashes raw bytes without lossy text decoding', async () => {
    // SHA-256 of the single byte 0xff — not of its U+FFFD replacement
    const out = await util.apply(new Uint8Array([0xff]), { algo: 'SHA-256' })
    expect(out).toBe('a8100ae6aa1940d0b663bb31cd466142ebbdbd5187131b92d93818987832eb89')
  })

  it('hashes bytes identically to the equivalent string', async () => {
    const fromBytes = await util.apply(new TextEncoder().encode('abc'), {})
    const fromString = await util.apply('abc', {})
    expect(fromBytes).toBe(fromString)
  })
})
