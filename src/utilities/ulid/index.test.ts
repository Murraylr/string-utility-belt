import { describe, it, expect } from 'vitest'
import util from './index'

const ULID = /^[0-9A-HJKMNP-TV-Z]{26}$/
const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

/** Decode the 10-character time prefix back to milliseconds. */
const decodeTime = (id: string) =>
  Array.from(id.slice(0, 10)).reduce((acc, c) => acc * 32 + CROCKFORD.indexOf(c), 0)

describe('ulid', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('ulid')
    expect(util.name).toBe('ulid')
    expect(util.category).toBe('Generators')
    expect(util.accepts).toBe('string')
    expect(util.produces).toBe('string')
  })

  it('generates a 26-character Crockford base32 ulid', async () => {
    const out = String(await util.apply('', {}))
    expect(out).toHaveLength(26)
    expect(out).toMatch(ULID)
    expect(String(await util.apply('', {}))).not.toBe(out)
    // Crockford drops I, L, O and U so the alphabet cannot produce them
    expect(out).not.toMatch(/[ILOU]/)
  })

  it('encodes the current time in the first 10 characters', async () => {
    const out = String(await util.apply('', {}))
    expect(Math.abs(Date.now() - decodeTime(out))).toBeLessThan(60000)
    // 48 bits of time in 50 bits of base32 ⇒ the leading character never exceeds 7
    expect('01234567').toContain(out[0])
  })

  it('honours an explicit timestamp', async () => {
    // published ULID spec vector: 1469918176385 ⇒ time prefix 01ARYZ6S41
    const out = String(await util.apply('', { timestamp: 1469918176385 }))
    expect(out.slice(0, 10)).toBe('01ARYZ6S41')
    expect(decodeTime(out)).toBe(1469918176385)
    expect(String(await util.apply('', { timestamp: 0 })).slice(0, 10)).not.toBe('0000000000')
    expect(String(await util.apply('', { timestamp: 1 })).slice(0, 10)).toBe('0000000001')
    // the largest representable 48-bit timestamp
    expect(String(await util.apply('', { timestamp: 281474976710655 })).slice(0, 10)).toBe('7ZZZZZZZZZ')
  })

  it('draws fresh entropy for the same timestamp', async () => {
    const a = String(await util.apply('', { timestamp: 1469918176385 }))
    const b = String(await util.apply('', { timestamp: 1469918176385 }))
    expect(a.slice(0, 10)).toBe(b.slice(0, 10))
    expect(a.slice(10)).not.toBe(b.slice(10))
    expect(a.slice(10)).toHaveLength(16)
  })

  it('is monotonic within a batch', async () => {
    const lines = String(await util.apply('', { count: 5, timestamp: 1469918176385 })).split('\n')
    expect(lines).toHaveLength(5)
    expect(new Set(lines).size).toBe(5)
    expect([...lines].sort()).toEqual(lines)
    for (const line of lines) expect(line).toMatch(ULID)
    // and for an unseeded batch large enough to roll the low base32 digits over
    const big = String(await util.apply('', { count: 200 })).split('\n')
    expect(new Set(big).size).toBe(200)
    expect([...big].sort()).toEqual(big)
  })

  it('is reproducible with a non-zero seed', async () => {
    expect(await util.apply('', { seed: 42, timestamp: 1469918176385, count: 3 }))
      .toBe('01ARYZ6S41XXY75GSBHBD3PCP0\n01ARYZ6S41XXY75GSBHBD3PCP1\n01ARYZ6S41XXY75GSBHBD3PCP2')
    expect(await util.apply('', { seed: 42 })).toBe('01DZW4HNVW5E5DMESJR2NQ7C5D')
    expect(await util.apply('', { seed: 43 })).not.toBe(await util.apply('', { seed: 42 }))
    expect(await util.apply('', { seed: -7 })).toBe(await util.apply('', { seed: -7 }))
  })

  it('ignores its input, including unicode and empty input', async () => {
    expect(String(await util.apply('', {}))).toMatch(ULID)
    expect(String(await util.apply('🎉 naïve 日本語', {}))).toMatch(ULID)
  })

  it('throws on an invalid timestamp or count', () => {
    expect(() => util.apply('', { timestamp: -1 })).toThrow(/timestamp must not be negative/)
    expect(() => util.apply('', { timestamp: 281474976710656 })).toThrow(/48 bits/)
    expect(() => util.apply('', { count: 0 })).toThrow(/count must be at least 1/)
    expect(() => util.apply('', { count: 10001 })).toThrow(/count must be 10000 or less/)
  })
})
