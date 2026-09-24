import { describe, it, expect } from 'vitest'
import util from './index'
import decompressUtil from '../gzip_decompress'

const gz = async (input: unknown, params: Record<string, unknown> = {}) =>
  (await util.apply(input as never, params)) as Uint8Array

const ungz = async (bytes: Uint8Array) =>
  (await decompressUtil.apply(bytes, { output: 'text' })) as string

const ungzBytes = async (bytes: Uint8Array) =>
  (await decompressUtil.apply(bytes, { output: 'bytes' })) as Uint8Array

const toHex = (b: Uint8Array) => Array.from(b, (n) => n.toString(16).padStart(2, '0')).join('')

/**
 * A payload whose compressed size actually varies with the level, so a dropped or
 * ignored `level` param cannot hide behind an input that compresses identically
 * at every setting.
 */
const levelSample = JSON.stringify(
  Array.from({ length: 200 }, (_, i) => ({
    id: i,
    name: `user${i}`,
    tags: ['a', 'b', 'c'],
    active: i % 2 === 0
  }))
)

describe('gzip_compress', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('gzip_compress')
    expect(util.name).toBe('gzip compress')
    expect(util.category).toBe('Compression')
    expect(util.accepts).toEqual(['string', 'bytes'])
    expect(util.produces).toBe('bytes')
  })

  it('declares a level param defaulting to 6', () => {
    expect(util.params.level.kind).toBe('number')
    expect(util.params.level.default).toBe(6)
    expect(Object.keys(util.params)).toEqual(['level'])
  })

  it('emits a gzip stream with the right magic and deflate method', async () => {
    const out = await gz('The quick brown fox jumps over the lazy dog.')
    expect(out).toBeInstanceOf(Uint8Array)
    expect(out[0]).toBe(0x1f)
    expect(out[1]).toBe(0x8b)
    expect(out[2]).toBe(0x08)
    expect(await ungz(out)).toBe('The quick brown fox jumps over the lazy dog.')
  })

  it('produces the exact RFC 1952 stream for a known input', async () => {
    // Golden vector: byte-for-byte output for level 6 with a zeroed MTIME.
    // Independently confirmed with node's zlib:
    //   zlib.gunzipSync(Buffer.from(hex, 'hex')).toString() === 'Hello, gzip!'
    expect(toHex(await gz('Hello, gzip!'))).toBe(
      '1f8b0800000000000003f348cdc9c9d75148afca2c5004003e3d0f100c000000'
    )
  })

  it('actually shrinks repetitive input', async () => {
    const source = 'abcdefghij'.repeat(400)
    const out = await gz(source)
    expect(out.length).toBeLessThan(source.length / 10)
    expect(await ungz(out)).toBe(source)
  })

  it('returns empty output for empty input', async () => {
    expect(await gz('')).toEqual(new Uint8Array(0))
    expect(await gz(new Uint8Array(0))).toEqual(new Uint8Array(0))
  })

  it('round-trips unicode, including astral characters', async () => {
    const source = 'héllo → 世界 🎉👩‍👩‍👧‍👦 ünïcödé'
    expect(await ungz(await gz(source))).toBe(source)
  })

  it('round-trips arbitrary binary bytes exactly', async () => {
    const source = new Uint8Array(256)
    for (let i = 0; i < 256; i++) source[i] = i
    expect(await ungzBytes(await gz(source))).toEqual(source)
  })

  it('stores rather than compresses at level 0', async () => {
    const source = 'compress me please '.repeat(200)
    const stored = await gz(source, { level: 0 })
    const best = await gz(source, { level: 9 })
    expect(stored.length).toBeGreaterThan(source.length)
    expect(best.length).toBeLessThan(stored.length)
    expect(await ungz(stored)).toBe(source)
    expect(await ungz(best)).toBe(source)
  })

  it('compresses harder as the level rises, and defaults to 6', async () => {
    const fastest = await gz(levelSample, { level: 1 })
    const six = await gz(levelSample, { level: 6 })
    const best = await gz(levelSample, { level: 9 })
    expect(fastest.length).toBeGreaterThan(best.length)
    expect(six.length).toBeLessThanOrEqual(fastest.length)
    // omitting the param must behave exactly like the documented default
    expect(await gz(levelSample)).toEqual(six)
    expect(await ungz(fastest)).toBe(levelSample)
    expect(await ungz(best)).toBe(levelSample)
  })

  it('accepts every level from 0 to 9', async () => {
    for (let level = 0; level <= 9; level++) {
      expect(await ungz(await gz('level check', { level }))).toBe('level check')
    }
  })

  it('produces deterministic output (no embedded timestamp)', async () => {
    const a = await gz('deterministic')
    const b = await gz('deterministic')
    expect(a).toEqual(b)
    // MTIME field (bytes 4-7) must be zeroed
    expect(Array.from(a.slice(4, 8))).toEqual([0, 0, 0, 0])
  })

  it('rejects an out-of-range or non-integer level', async () => {
    await expect(util.apply('x', { level: 10 })).rejects.toThrow(/level must be/)
    await expect(util.apply('x', { level: -1 })).rejects.toThrow(/level must be/)
    await expect(util.apply('x', { level: 1.5 })).rejects.toThrow(/level must be/)
    await expect(util.apply('x', { level: 'high' })).rejects.toThrow(/level must be/)
  })
})
