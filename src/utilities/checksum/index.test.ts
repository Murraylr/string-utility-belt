import { describe, it, expect, vi } from 'vitest'
import util from './index'
import { textToUint8Array } from '../helpers'

// hash-wasm must only be pulled in by the algorithms that actually use it —
// the pipeline re-runs on every keystroke, so a pure-JS checksum must not drag
// the wasm bundle in. The counter also proves the import is dynamic.
const dep = vi.hoisted(() => ({ loads: 0 }))
vi.mock('hash-wasm', async (importOriginal) => {
  dep.loads++
  return await importOriginal<typeof import('hash-wasm')>()
})

// the classic CRC check vector
const CHECK = '123456789'
const LONG = 'The quick brown fox jumps over the lazy dog. Pack my box with five dozen liquor jugs.'
const HIGH = new Uint8Array([0xff, 0x00, 0x80, 0x7f, 0xfe, 0x01])

describe('checksum', () => {
  // NOTE: must stay the first test in this file — the utility caches the module
  // after the first hash-wasm-backed algorithm runs.
  it('does not load hash-wasm for the hand-rolled algorithms', async () => {
    expect(await util.apply(CHECK, { algorithm: 'djb2' })).toBe('35cdbb82')
    expect(await util.apply(CHECK, { algorithm: 'sdbm' })).toBe('68a07035')
    expect(await util.apply(CHECK, { algorithm: 'FNV-1a-32' })).toBe('bb86b11c')
    expect(await util.apply(CHECK, { algorithm: 'MurmurHash3-32' })).toBe('b4fef382')
    expect(await util.apply(CHECK, { algorithm: 'CRC-16-CCITT' })).toBe('29b1')
    expect(await util.apply(CHECK, { algorithm: 'Java-hashCode' })).toBe('90b21035')
    expect(dep.loads).toBe(0)
    // ...but it is loaded (once) for the ones that need it
    expect(await util.apply(CHECK, { algorithm: 'CRC-32' })).toBe('cbf43926')
    expect(await util.apply(CHECK, { algorithm: 'xxHash-64' })).toBe('8cb841db40e6ae83')
    expect(dep.loads).toBe(1)
  })

  it('has correct metadata', () => {
    expect(util.id).toBe('checksum')
    expect(util.name).toBe('checksum')
    expect(util.category).toBe('Hashing')
    expect(util.accepts).toEqual(['string', 'bytes'])
    expect(util.produces).toBe('string')
    expect(util.params.seed.kind).toBe('number')
    expect((util.params.algorithm as { default: string }).default).toBe('CRC-32')
    expect((util.params.output as { default: string }).default).toBe('hex')
    expect((util.params.seed as { default: number }).default).toBe(0)
  })

  it('defaults to CRC-32 in hex', async () => {
    expect(await util.apply(CHECK, {})).toBe('cbf43926')
    expect(await util.apply('abc', {})).toBe('352441c2')
  })

  it('matches the published check value for every algorithm', async () => {
    expect(await util.apply(CHECK, { algorithm: 'CRC-32' })).toBe('cbf43926')
    expect(await util.apply(CHECK, { algorithm: 'CRC-32C' })).toBe('e3069283')
    expect(await util.apply(CHECK, { algorithm: 'CRC-16-CCITT' })).toBe('29b1')
    expect(await util.apply(CHECK, { algorithm: 'CRC-16-MODBUS' })).toBe('4b37')
    expect(await util.apply(CHECK, { algorithm: 'Adler-32' })).toBe('091e01de')
    expect(await util.apply(CHECK, { algorithm: 'FNV-1a-32' })).toBe('bb86b11c')
    expect(await util.apply(CHECK, { algorithm: 'FNV-1a-64' })).toBe('06d5573923c6cdfc')
    expect(await util.apply(CHECK, { algorithm: 'MurmurHash3-32' })).toBe('b4fef382')
    expect(await util.apply(CHECK, { algorithm: 'xxHash-32' })).toBe('937bad67')
    expect(await util.apply(CHECK, { algorithm: 'xxHash-64' })).toBe('8cb841db40e6ae83')
    expect(await util.apply(CHECK, { algorithm: 'Java-hashCode' })).toBe('90b21035')
    expect(await util.apply(CHECK, { algorithm: 'djb2' })).toBe('35cdbb82')
    expect(await util.apply(CHECK, { algorithm: 'sdbm' })).toBe('68a07035')
  })

  it('matches well-known digests of "hello"', async () => {
    expect(await util.apply('hello', { algorithm: 'FNV-1a-32' })).toBe('4f9f2cab')
    expect(await util.apply('hello', { algorithm: 'FNV-1a-64' })).toBe('a430d84680aabd0b')
    expect(await util.apply('hello', { algorithm: 'MurmurHash3-32' })).toBe('248bfa47')
    expect(await util.apply('hello', { algorithm: 'djb2' })).toBe('0f923099')
    expect(await util.apply('hello', { algorithm: 'Java-hashCode', output: 'decimal' })).toBe('99162322')
  })

  it('handles every MurmurHash3 tail length (0–3 leftover bytes)', async () => {
    expect(await util.apply('abcd', { algorithm: 'MurmurHash3-32' })).toBe('43ed676a')
    expect(await util.apply('abcde', { algorithm: 'MurmurHash3-32' })).toBe('e89b9af6')
    expect(await util.apply('abcdef', { algorithm: 'MurmurHash3-32' })).toBe('6181c085')
    expect(await util.apply('abcdefg', { algorithm: 'MurmurHash3-32' })).toBe('883c9b06')
  })

  it('handles multi-block input', async () => {
    expect(await util.apply(LONG, { algorithm: 'CRC-32' })).toBe('fb4d52f2')
    expect(await util.apply(LONG, { algorithm: 'CRC-32C' })).toBe('77bc1dfc')
    expect(await util.apply(LONG, { algorithm: 'CRC-16-CCITT' })).toBe('d38e')
    expect(await util.apply(LONG, { algorithm: 'CRC-16-MODBUS' })).toBe('212a')
    expect(await util.apply(LONG, { algorithm: 'Adler-32' })).toBe('29501ebf')
    expect(await util.apply(LONG, { algorithm: 'FNV-1a-32' })).toBe('8c7a9b6f')
    expect(await util.apply(LONG, { algorithm: 'FNV-1a-64' })).toBe('99f7cb927af94eaf')
    expect(await util.apply(LONG, { algorithm: 'MurmurHash3-32' })).toBe('4f4d17eb')
    expect(await util.apply(LONG, { algorithm: 'xxHash-32' })).toBe('e9c84f9a')
    expect(await util.apply(LONG, { algorithm: 'xxHash-64' })).toBe('ba70006822ceb306')
    expect(await util.apply(LONG, { algorithm: 'Java-hashCode' })).toBe('8ca50f3e')
    expect(await util.apply(LONG, { algorithm: 'djb2' })).toBe('fd1d8323')
    expect(await util.apply(LONG, { algorithm: 'sdbm' })).toBe('32c725fe')
    // Adler's modulo bookkeeping over a long run
    expect(await util.apply('a'.repeat(10000), { algorithm: 'Adler-32' })).toBe('9fbbcde3')
    expect(await util.apply('a'.repeat(10000), { algorithm: 'CRC-32' })).toBe('467ed497')
  })

  it('handles bytes above 0x7f without sign errors', async () => {
    expect(await util.apply(HIGH, { algorithm: 'CRC-32' })).toBe('1aca6f9c')
    expect(await util.apply(HIGH, { algorithm: 'CRC-16-CCITT' })).toBe('5341')
    expect(await util.apply(HIGH, { algorithm: 'Adler-32' })).toBe('0b7a02fe')
    expect(await util.apply(HIGH, { algorithm: 'FNV-1a-32' })).toBe('0aa6a222')
    expect(await util.apply(HIGH, { algorithm: 'FNV-1a-64' })).toBe('130adcd29188a782')
    expect(await util.apply(HIGH, { algorithm: 'MurmurHash3-32' })).toBe('b92e7053')
    expect(await util.apply(HIGH, { algorithm: 'djb2' })).toBe('5afaeaa2')
    expect(await util.apply(HIGH, { algorithm: 'sdbm' })).toBe('99252cc3')
  })

  it('pads hex to the algorithm width', async () => {
    expect(String(await util.apply(CHECK, { algorithm: 'CRC-16-CCITT' })).length).toBe(4)
    expect(String(await util.apply(CHECK, { algorithm: 'CRC-32' })).length).toBe(8)
    expect(String(await util.apply(CHECK, { algorithm: 'xxHash-64' })).length).toBe(16)
    // a digest with leading zero nibbles keeps them
    expect(await util.apply(CHECK, { algorithm: 'Adler-32' })).toBe('091e01de')
    expect(await util.apply(CHECK, { algorithm: 'FNV-1a-64' })).toBe('06d5573923c6cdfc')
  })

  it('supports decimal output, signed for Java-hashCode', async () => {
    expect(await util.apply(CHECK, { algorithm: 'CRC-32', output: 'decimal' })).toBe('3421780262')
    expect(await util.apply(CHECK, { algorithm: 'CRC-16-MODBUS', output: 'decimal' })).toBe('19255')
    expect(await util.apply(CHECK, { algorithm: 'FNV-1a-64', output: 'decimal' })).toBe('492395637191921148')
    expect(await util.apply(CHECK, { algorithm: 'xxHash-64', output: 'decimal' })).toBe('10139926970967174787')
    expect(await util.apply(CHECK, { algorithm: 'Adler-32', output: 'decimal' })).toBe('152961502')
    // java.lang.String.hashCode is a signed int
    expect(await util.apply(CHECK, { algorithm: 'Java-hashCode', output: 'decimal' })).toBe('-1867378635')
    expect(await util.apply('abc', { algorithm: 'Java-hashCode', output: 'decimal' })).toBe('96354')
  })

  it('returns empty string for empty input without throwing', async () => {
    expect(await util.apply('', {})).toBe('')
    expect(await util.apply(new Uint8Array([]), {})).toBe('')
    expect(await util.apply('', { algorithm: 'xxHash-64', output: 'decimal', seed: 7 })).toBe('')
  })

  it('checksums non-ASCII text over its UTF-8 bytes', async () => {
    const text = 'héllo 🌍'
    expect(await util.apply(text, { algorithm: 'CRC-32' })).toBe('dd3887da')
    expect(await util.apply(textToUint8Array(text), { algorithm: 'CRC-32' })).toBe('dd3887da')
    // Java-hashCode is defined over UTF-16 code units, so the emoji contributes
    // its surrogate pair rather than being dropped
    expect(await util.apply(text, { algorithm: 'Java-hashCode', output: 'decimal' })).toBe('395407843')
    expect(await util.apply(text, { algorithm: 'Java-hashCode' })).not.toBe(
      await util.apply('héllo ', { algorithm: 'Java-hashCode' })
    )
  })

  it('accepts raw bytes, including views, and never mutates them', async () => {
    expect(await util.apply(new Uint8Array([97, 98, 99]), { algorithm: 'CRC-32' })).toBe('352441c2')
    expect(
      await util.apply(new Uint8Array([97, 98, 99]), { algorithm: 'Java-hashCode', output: 'decimal' })
    ).toBe('96354')
    // a subarray view must be hashed from its own offset
    const view = new Uint8Array([9, 9, 97, 98, 99]).subarray(2)
    expect(await util.apply(view, { algorithm: 'CRC-32' })).toBe('352441c2')

    const bytes = new Uint8Array([1, 2, 3, 4, 5])
    const before = Array.from(bytes)
    await util.apply(bytes, { algorithm: 'CRC-32' })
    await util.apply(bytes, { algorithm: 'sdbm', seed: 9 })
    expect(Array.from(bytes)).toEqual(before)
  })

  it('uses seed as a resumable running value for the CRCs and Adler-32', async () => {
    const crcHead = await util.apply('1234', { algorithm: 'CRC-32', output: 'decimal' })
    expect(crcHead).toBe('2615402659')
    expect(
      await util.apply('56789', { algorithm: 'CRC-32', output: 'decimal', seed: Number(crcHead) })
    ).toBe('3421780262') // === CRC-32('123456789')

    // same property for CRC-32C, which crosses the hash-wasm / hand-rolled seam
    const crcCHead = await util.apply('1234', { algorithm: 'CRC-32C', output: 'decimal' })
    expect(crcCHead).toBe('4131058926')
    expect(await util.apply('56789', { algorithm: 'CRC-32C', seed: Number(crcCHead) })).toBe('e3069283')

    const adlerHead = await util.apply('1234', { algorithm: 'Adler-32', output: 'decimal' })
    expect(adlerHead).toBe('33030347')
    expect(
      await util.apply('56789', { algorithm: 'Adler-32', output: 'decimal', seed: Number(adlerHead) })
    ).toBe('152961502') // === Adler-32('123456789')
    // Adler's standard start state is 1, so seeding with it changes nothing
    expect(await util.apply('hello', { algorithm: 'Adler-32', seed: 1 })).toBe(
      await util.apply('hello', { algorithm: 'Adler-32' })
    )
  })

  it('applies the seed to every seedable algorithm', async () => {
    expect(await util.apply('hello', { algorithm: 'MurmurHash3-32', seed: 42 })).toBe('e2dbd2e1')
    expect(await util.apply('hello', { algorithm: 'xxHash-32', seed: 42 })).toBe('4d02c966')
    expect(await util.apply('hello', { algorithm: 'xxHash-64', seed: 42 })).toBe('c3629e6318d53932')
    // a seed wider than 32 bits reaches xxHash-64's high word
    expect(await util.apply('hello', { algorithm: 'xxHash-64', seed: 1099511627776 })).toBe(
      'd441f7c9a92c920a'
    )
    expect(await util.apply('hello', { algorithm: 'FNV-1a-32', seed: 1 })).toBe('f5ab40cf')
    expect(await util.apply('hello', { algorithm: 'FNV-1a-64', seed: 1 })).toBe('df44c46564a5c1cf')
    expect(await util.apply('hello', { algorithm: 'djb2', seed: 1 })).toBe('09e85915')
    expect(await util.apply('hello', { algorithm: 'sdbm', seed: 1 })).toBe('3efdfa71')
    expect(await util.apply('hello', { algorithm: 'Java-hashCode', seed: 1, output: 'decimal' })).toBe(
      '127791473'
    )
    expect(await util.apply(CHECK, { algorithm: 'CRC-16-CCITT', seed: 1 })).toBe('7610')
    expect(await util.apply(CHECK, { algorithm: 'CRC-16-MODBUS', seed: 1 })).toBe('2b30')
    expect(await util.apply(CHECK, { algorithm: 'CRC-32C', seed: 1 })).toBe('173844cb')
    // a negative seed is read as the equivalent unsigned 32-bit value
    expect(await util.apply('hello', { algorithm: 'MurmurHash3-32', seed: -1 })).toBe(
      await util.apply('hello', { algorithm: 'MurmurHash3-32', seed: 4294967295 })
    )
    // and a non-zero seed always changes the result
    expect(await util.apply('hello', { algorithm: 'xxHash-32', seed: 42 })).not.toBe(
      await util.apply('hello', { algorithm: 'xxHash-32', seed: 0 })
    )
    // an empty seed field means "standard start"
    expect(await util.apply('hello', { algorithm: 'djb2', seed: '' })).toBe(
      await util.apply('hello', { algorithm: 'djb2' })
    )
  })

  it('throws on unknown options and unusable seeds', async () => {
    await expect(util.apply('hello', { algorithm: 'CRC-64' })).rejects.toThrow(/unknown algorithm/)
    await expect(util.apply('hello', { output: 'base64' })).rejects.toThrow(/unknown output format/)
    await expect(util.apply('hello', { seed: 'nope' })).rejects.toThrow(/finite number/)
    await expect(util.apply('hello', { seed: 1e30 })).rejects.toThrow(/too large/)
  })
})
