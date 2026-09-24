import { describe, it, expect } from 'vitest'
import util from './index'
import { textToUint8Array } from '../helpers'

const run = async (input: unknown, params: Record<string, unknown> = {}) =>
  (await util.apply(input as never, params)) as Record<string, unknown>

const HELLO_SHA256 = '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824'
const HELLO_MD5 = '5d41402abc4b2a76b9719d911017c592'

describe('checksum_verify', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('checksum_verify')
    expect(util.name).toBe('checksum verify')
    expect(util.category).toBe('Hashing')
    expect(util.accepts).toEqual(['string', 'bytes'])
    expect(util.produces).toBe('json')
    expect(Object.keys(util.params).sort()).toEqual(['algorithm', 'expected'])
  })

  it('returns a real object reporting a match', async () => {
    const result = await run('hello', { expected: HELLO_SHA256 })
    expect(result).toEqual({
      algorithm: 'SHA-256',
      actual: HELLO_SHA256,
      expected: HELLO_SHA256,
      match: true
    })
  })

  it('reports a mismatch without throwing', async () => {
    const result = await run('hello', { expected: 'deadbeef' })
    expect(result.match).toBe(false)
    expect(result.actual).toBe(HELLO_SHA256)
    expect(result.expected).toBe('deadbeef')
  })

  it('computes every algorithm option', async () => {
    expect((await run('hello', { algorithm: 'MD5' })).actual).toBe(HELLO_MD5)
    expect((await run('hello', { algorithm: 'SHA-1' })).actual)
      .toBe('aaf4c61ddcc5e8a2dabede0f3b482cd9aea9434d')
    expect((await run('hello', { algorithm: 'SHA-256' })).actual).toBe(HELLO_SHA256)
    expect((await run('hello', { algorithm: 'SHA-384' })).actual).toBe(
      '59e1748777448c69de6b800d7a33bbfb9ff1b463e44354c3553bcdb9c666fa90125a3c79f90397bdf5f6a13de828684f'
    )
    expect((await run('hello', { algorithm: 'SHA-512' })).actual).toBe(
      '9b71d224bd62f3785d96d46ad3ea3d73319bfbc2890caadae2dff72519673ca72323c3d99ba5c11d7c7acc6e14b8c5da0c4663475c2e5c3adef46f73bcdec043'
    )
    expect((await run('hello', { algorithm: 'CRC-32' })).actual).toBe('3610a686')
  })

  it('hand-rolled md5 matches known vectors across block boundaries', async () => {
    expect((await run('', { algorithm: 'MD5' })).actual).toBe('d41d8cd98f00b204e9800998ecf8427e')
    expect((await run('abc', { algorithm: 'MD5' })).actual).toBe('900150983cd24fb0d6963f7d28e17f72')
    expect((await run('The quick brown fox jumps over the lazy dog', { algorithm: 'MD5' })).actual)
      .toBe('9e107d9d372bb6826bd81d3542a419d6')
    // 55 is the last length whose 0x80 + 8-byte length field still fits one
    // block; 56 forces a second block. Classic off-by-one boundary.
    expect((await run('a'.repeat(55), { algorithm: 'MD5' })).actual)
      .toBe('ef1772b6dff9a122358552954ad0df65')
    expect((await run('a'.repeat(56), { algorithm: 'MD5' })).actual)
      .toBe('3b0c8ac703f828b04c6c197006d17218')
    // exactly one padding-forced extra block, then a multi-block message
    expect((await run('a'.repeat(64), { algorithm: 'MD5' })).actual)
      .toBe('014842d480b571495a4a0363793f7367')
    expect((await run('a'.repeat(1000), { algorithm: 'MD5' })).actual)
      .toBe('cabe45dcc9ae5b66ba86600cca6b8ba8')
  })

  it('handles empty input for every algorithm without throwing', async () => {
    const sha = await run('', { expected: '' })
    expect(sha.actual).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
    expect(sha.match).toBe(false)
    expect((await run('', { algorithm: 'CRC-32' })).actual).toBe('00000000')
    expect((await run(new Uint8Array([]), { algorithm: 'MD5' })).actual)
      .toBe('d41d8cd98f00b204e9800998ecf8427e')
  })

  it('hashes unicode and byte input correctly', async () => {
    expect((await run('\u{1F510} café', { algorithm: 'MD5' })).actual)
      .toBe('08e2bfd05a854283d49d10c0dbf62687')
    expect((await run('\u{1F510} café', { algorithm: 'CRC-32' })).actual).toBe('fbcb15a9')
    expect((await run(textToUint8Array('hello'), { algorithm: 'MD5', expected: HELLO_MD5 })).match)
      .toBe(true)
    expect((await run('123456789', { algorithm: 'CRC-32', expected: 'CBF43926' })).match).toBe(true)
  })

  it('compares case-insensitively and tolerates surrounding whitespace', async () => {
    expect((await run('hello', { expected: `  ${HELLO_SHA256.toUpperCase()}  ` })).match).toBe(true)
    expect((await run('hello', { algorithm: 'CRC-32', expected: '0x3610a686' })).match).toBe(true)
  })

  it('matches a CRC-32 whose leading zeros were dropped', async () => {
    // crc32('v60') is 00f86c29, and tools print it as plain 0xf86c29
    expect((await run('v60', { algorithm: 'CRC-32' })).actual).toBe('00f86c29')
    expect((await run('v60', { algorithm: 'CRC-32', expected: 'f86c29' })).match).toBe(true)
    expect((await run('v60', { algorithm: 'CRC-32', expected: '0xF86C29' })).match).toBe(true)
    expect((await run('v60', { algorithm: 'CRC-32', expected: '00f86c29' })).match).toBe(true)
    // a genuinely different checksum still fails, short form or not
    expect((await run('v60', { algorithm: 'CRC-32', expected: 'f86c28' })).match).toBe(false)
  })

  it('accepts `hash  filename` and BSD checksum lines', async () => {
    const coreutils = await run('hello', { algorithm: 'MD5', expected: `${HELLO_MD5}  greeting.txt` })
    expect(coreutils.expected).toBe(HELLO_MD5)
    expect(coreutils.match).toBe(true)
    const bsd = await run('hello', { algorithm: 'MD5', expected: `MD5 (greeting.txt) = ${HELLO_MD5}` })
    expect(bsd.match).toBe(true)
    const binaryMode = await run('hello', { algorithm: 'MD5', expected: `${HELLO_MD5} *greeting.bin` })
    expect(binaryMode.match).toBe(true)
  })

  it('accepts a base64 expected digest', async () => {
    expect((await run('hello', { expected: 'LPJNul+wow4m6DsqxbninhsWHlwfp0JecwQzYpOLmCQ=' })).match)
      .toBe(true)
    expect((await run('hello', { expected: 'LPJNul-wow4m6DsqxbninhsWHlwfp0JecwQzYpOLmCQ' })).match)
      .toBe(true)
  })

  it('reports no match for an unreadable expected digest instead of throwing', async () => {
    // odd digit count is not a digest, and must not be zero-padded into one
    const odd = await run('hello', { expected: HELLO_SHA256.slice(1) })
    expect(odd.match).toBe(false)
    expect(odd.actual).toBe(HELLO_SHA256)
    expect((await run('hello', { expected: 'not a hash at all' })).match).toBe(false)
    // a correct digest truncated by one byte must not be treated as a prefix match
    expect((await run('hello', { expected: HELLO_SHA256.slice(0, -2) })).match).toBe(false)
  })

  it('throws on an unsupported algorithm', async () => {
    await expect(util.apply('hello', { algorithm: 'SHA-3' })).rejects.toThrow('unsupported checksum algorithm')
  })
})
