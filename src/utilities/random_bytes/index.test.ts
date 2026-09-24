import { describe, it, expect } from 'vitest'
import util from './index'

/**
 * Reference vectors: the byte stream is mulberry32(seed) -> floor(r() * 256), and the
 * encodings below were produced independently with node's Buffer
 * (`Buffer.from(bytes).toString('hex' | 'base64' | 'base64url')`), not by this module.
 */
const VECTORS = [
  { seed: 1, count: 4, hex: 'a00087fb', b64: 'oACH+w==', b64url: 'oACH-w', dec: '160 0 135 251' },
  { seed: 3, count: 5, hex: 'b8097413c3', b64: 'uAl0E8M=', b64url: 'uAl0E8M', dec: '184 9 116 19 195' },
  {
    seed: 42, count: 8, hex: '9972daab2c86459f', b64: 'mXLaqyyGRZ8=', b64url: 'mXLaqyyGRZ8',
    dec: '153 114 218 171 44 134 69 159'
  },
  {
    seed: 7, count: 8, hex: '020ffab28567773d', b64: 'Ag/6soVndz0=', b64url: 'Ag_6soVndz0',
    dec: '2 15 250 178 133 103 119 61'
  },
  {
    seed: 9, count: 16, hex: '32d924d2b9b043eb21a1b29648f049ba', b64: 'Mtkk0rmwQ+shobKWSPBJug==',
    b64url: 'Mtkk0rmwQ-shobKWSPBJug', dec: '50 217 36 210 185 176 67 235 33 161 178 150 72 240 73 186'
  }
]

const toHex = (b: Uint8Array) => Array.from(b).map((x) => x.toString(16).padStart(2, '0')).join('')

describe('random_bytes', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('random_bytes')
    expect(util.name).toBe('random bytes')
    expect(util.category).toBe('Generators')
    expect(util.accepts).toBe('string')
    expect(util.produces).toEqual(['string', 'bytes'])
  })

  it('is deterministic for a non-zero seed', async () => {
    expect(await util.apply('', { count: 8, seed: 42 })).toBe('9972daab2c86459f')
    expect(await util.apply('', { count: 8, seed: 42 })).toBe('9972daab2c86459f')
    expect(await util.apply('', { count: 8, seed: 43 })).toBe('ff46870f10be0b0f')
  })

  it('matches independently computed vectors in every output format', async () => {
    for (const v of VECTORS) {
      const p = { count: v.count, seed: v.seed }
      expect(await util.apply('', { ...p, output: 'hex' })).toBe(v.hex)
      expect(await util.apply('', { ...p, output: 'base64' })).toBe(v.b64)
      expect(await util.apply('', { ...p, output: 'base64url' })).toBe(v.b64url)
      expect(await util.apply('', { ...p, output: 'decimal' })).toBe(v.dec)
      expect(toHex((await util.apply('', { ...p, output: 'bytes' })) as Uint8Array)).toBe(v.hex)
      expect(await util.apply('', { ...p, output: 'c-array' }))
        .toBe(`uint8_t data[${v.count}] = { ${v.hex.match(/../g)!.map((h) => `0x${h}`).join(', ')} };`)
    }
  })

  it('uses crypto randomness when the seed is 0', async () => {
    const a = String(await util.apply('', { count: 32 }))
    const b = String(await util.apply('', { count: 32 }))
    expect(a).toHaveLength(64)
    expect(a).toMatch(/^[0-9a-f]{64}$/)
    expect(a).not.toBe(b)
  })

  it('covers the whole 0..255 range on both the crypto and the seeded path', async () => {
    const rand = (await util.apply('', { count: 20000, output: 'bytes' })) as Uint8Array
    const seeded = (await util.apply('', { count: 20000, seed: 5, output: 'bytes' })) as Uint8Array
    expect(new Set(rand).size).toBe(256)
    expect(new Set(seeded).size).toBe(256)
  })

  it('ignores its input, including non-ASCII text', async () => {
    const seeded = await util.apply('', { count: 8, seed: 7 })
    expect(await util.apply('🎲 naïve 日本語', { count: 8, seed: 7 })).toBe(seeded)
    expect(seeded).toBe('020ffab28567773d')
  })

  it('returns a standalone Uint8Array for the bytes output', async () => {
    const out = (await util.apply('', { count: 5, seed: 3, output: 'bytes' })) as Uint8Array
    expect(out).toBeInstanceOf(Uint8Array)
    expect(out).toHaveLength(5)
    expect(out.byteOffset).toBe(0)
    expect(out.buffer.byteLength).toBe(5)
  })

  it('produces empty output for a count of zero', async () => {
    expect(await util.apply('', { count: 0 })).toBe('')
    expect(await util.apply('', { count: 0, output: 'base64' })).toBe('')
    expect(await util.apply('', { count: 0, output: 'decimal' })).toBe('')
    expect(await util.apply('', { count: 0, output: 'c-array' })).toBe('')
    expect((await util.apply('', { count: 0, output: 'bytes' })) as Uint8Array).toHaveLength(0)
  })

  it('fills every chunk when the count crosses the 65536 crypto limit', async () => {
    const out = (await util.apply('', { count: 70000, output: 'bytes' })) as Uint8Array
    expect(out).toHaveLength(70000)
    // a subarray mix-up would leave the tail past the first chunk untouched (all zeros)
    const tail = out.subarray(65536)
    expect(new Set(tail).size).toBeGreaterThan(200)
  })

  it('rejects invalid counts and outputs', () => {
    expect(() => util.apply('', { count: -1 })).toThrow(/count must be zero or more/)
    expect(() => util.apply('', { count: 2000000 })).toThrow(/count must be 1048576 or less/)
    expect(() => util.apply('', { count: 'abc' })).toThrow(/count must be zero or more/)
    expect(() => util.apply('', { count: 4, output: 'nope' })).toThrow(/unknown output/)
    expect(() => util.apply('', { count: 0, output: 'nope' })).toThrow(/unknown output/)
  })
})
