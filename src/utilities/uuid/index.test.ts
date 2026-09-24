import { describe, it, expect } from 'vitest'
import util from './index'

const V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
const V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
const V1 = /^[0-9a-f]{8}-[0-9a-f]{4}-1[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

const hexOf = (uuid: string) => uuid.replace(/-/g, '')

/** Reassemble the 48-bit unix-millisecond prefix of a v7 uuid. */
const v7Millis = (uuid: string) => parseInt(hexOf(uuid).slice(0, 12), 16)

/** Reassemble the 60-bit v1 timestamp and convert it back to unix milliseconds. */
const v1Millis = (uuid: string) => {
  const h = hexOf(uuid)
  const ts =
    ((BigInt('0x' + h.slice(12, 16)) & 0x0fffn) << 48n) |
    (BigInt('0x' + h.slice(8, 12)) << 32n) |
    BigInt('0x' + h.slice(0, 8))
  return Number((ts - 122192928000000000n) / 10000n)
}

describe('uuid', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('uuid')
    expect(util.name).toBe('uuid')
    expect(util.category).toBe('Generators')
    expect(util.accepts).toBe('string')
    expect(util.produces).toBe('string')
  })

  it('generates a random v4 uuid by default', async () => {
    const out = String(await util.apply('', {}))
    expect(out).toMatch(V4)
    expect(out).toHaveLength(36)
    expect(String(await util.apply('', {}))).not.toBe(out)
  })

  it('ignores its input, including unicode and empty input', async () => {
    expect(String(await util.apply('', {}))).toMatch(V4)
    expect(String(await util.apply('🙂 café 日本語', {}))).toMatch(V4)
  })

  it('is reproducible with a non-zero seed', async () => {
    expect(await util.apply('', { seed: 42 })).toBe('8a2bc372-c032-4bda-adb0-73ab8a9ac02c')
    expect(await util.apply('', { seed: 42 })).toBe(await util.apply('', { seed: 42 }))
    expect(await util.apply('', { seed: 43 })).not.toBe(await util.apply('', { seed: 42 }))
    // a negative seed is still a seed, not a fall-through to crypto randomness
    expect(await util.apply('', { seed: -7 })).toBe(await util.apply('', { seed: -7 }))
  })

  it('generates count uuids, one per line', async () => {
    const lines = String(await util.apply('', { seed: 42, count: 3 })).split('\n')
    expect(lines).toHaveLength(3)
    expect(new Set(lines).size).toBe(3)
    for (const line of lines) expect(line).toMatch(V4)
    const many = String(await util.apply('', { count: 200 })).split('\n')
    expect(new Set(many).size).toBe(200)
  })

  it('applies the uppercase, hyphens and braces options', async () => {
    expect(await util.apply('', { seed: 42, uppercase: true })).toBe('8A2BC372-C032-4BDA-ADB0-73AB8A9AC02C')
    expect(await util.apply('', { seed: 42, hyphens: false })).toBe('8a2bc372c0324bdaadb073ab8a9ac02c')
    expect(await util.apply('', { seed: 42, braces: true })).toBe('{8a2bc372-c032-4bda-adb0-73ab8a9ac02c}')
    expect(await util.apply('', { seed: 42, uppercase: false, hyphens: true, braces: false }))
      .toBe('8a2bc372-c032-4bda-adb0-73ab8a9ac02c')
    expect(await util.apply('', { seed: 42, uppercase: true, hyphens: false, braces: true }))
      .toBe('{8A2BC372C0324BDAADB073AB8A9AC02C}')
  })

  it('generates v7 uuids whose 48-bit prefix is the current unix time', async () => {
    const out = String(await util.apply('', { version: 'v7' }))
    expect(out).toMatch(V7)
    expect(Math.abs(Date.now() - v7Millis(out))).toBeLessThan(60000)
    expect(await util.apply('', { version: 'v7', seed: 7 })).toBe('016f6165-fd2c-7c4b-ba16-9e5eb2f38b96')
    // the seeded clock is a fixed instant, so the decoded prefix is exact
    expect(v7Millis(String(await util.apply('', { version: 'v7', seed: 7 })))).toBe(1577887071532)
  })

  it('keeps a v7 batch time-ordered even within one millisecond', async () => {
    // RFC 9562 §6.2: ids minted in the same millisecond must still sort in
    // generation order, otherwise "time-ordered" is a lie for any batch.
    const lines = String(await util.apply('', { version: 'v7', count: 50 })).split('\n')
    expect(new Set(lines).size).toBe(50)
    expect([...lines].sort()).toEqual(lines)
    for (const line of lines) expect(line).toMatch(V7)
    // all 50 share the same millisecond prefix, so ordering comes from the counter
    expect(new Set(lines.map(v7Millis)).size).toBe(1)
    expect(await util.apply('', { version: 'v7', seed: 7, count: 3 })).toBe(
      '016f6165-fd2c-7c4b-ba16-9e5eb2f38b96\n' +
      '016f6165-fd2c-7c4b-ba16-9e5eb2f38b97\n' +
      '016f6165-fd2c-7c4b-ba16-9e5eb2f38b98'
    )
  })

  it('generates v1 uuids with a multicast node and a stable generator identity', async () => {
    const out = String(await util.apply('', { version: 'v1' }))
    expect(out).toMatch(V1)
    expect(parseInt(out.slice(24, 26), 16) & 1).toBe(1) // random node ⇒ multicast bit set
    expect(Math.abs(Date.now() - v1Millis(out))).toBeLessThan(60000)
    expect(await util.apply('', { version: 'v1', seed: 7 })).toBe('b372c6c0-2c9e-11ea-bf12-5f9e16fa968b')
    expect(v1Millis(String(await util.apply('', { version: 'v1', seed: 7 })))).toBe(1577887071532)

    const lines = String(await util.apply('', { version: 'v1', seed: 7, count: 3 })).split('\n')
    expect(new Set(lines).size).toBe(3)
    // one batch is one generator: clock sequence and node id stay put, the clock ticks
    expect(new Set(lines.map(l => l.slice(19))).size).toBe(1)
    expect(lines.map(l => l.slice(0, 8))).toEqual(['b372c6c0', 'b372c6c1', 'b372c6c2'])
  })

  it('generates the nil and max uuids', async () => {
    expect(await util.apply('', { version: 'nil' })).toBe('00000000-0000-0000-0000-000000000000')
    expect(await util.apply('', { version: 'max' })).toBe('ffffffff-ffff-ffff-ffff-ffffffffffff')
    expect(await util.apply('', { version: 'max', uppercase: true, braces: true }))
      .toBe('{FFFFFFFF-FFFF-FFFF-FFFF-FFFFFFFFFFFF}')
    expect(await util.apply('', { version: 'nil', hyphens: false })).toBe('0'.repeat(32))
  })

  it('always sets the version and variant bits, for every version', async () => {
    for (const [version, nibble, re] of [['v4', '4', V4], ['v7', '7', V7], ['v1', '1', V1]] as const) {
      const lines = String(await util.apply('', { version, count: 200 })).split('\n')
      expect(lines.every(l => re.test(l))).toBe(true)
      expect(new Set(lines.map(l => hexOf(l)[12]))).toEqual(new Set([nibble]))
      expect(lines.every(l => '89ab'.includes(hexOf(l)[16]))).toBe(true)
    }
  })

  it('throws on an unknown version or an out-of-range count', () => {
    expect(() => util.apply('', { version: 'v9' })).toThrow(/unknown uuid version/)
    expect(() => util.apply('', { version: 'V4' })).toThrow(/unknown uuid version/)
    expect(() => util.apply('', { count: 0 })).toThrow(/count must be at least 1/)
    expect(() => util.apply('', { count: -3 })).toThrow(/count must be at least 1/)
    expect(() => util.apply('', { count: 10001 })).toThrow(/count must be 10000 or less/)
  })
})
