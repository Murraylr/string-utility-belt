import { describe, it, expect } from 'vitest'
import util from './index'
import decompressUtil from '../deflate_decompress'

const def = async (input: unknown, params: Record<string, unknown> = {}) =>
  (await util.apply(input as never, params)) as Uint8Array

const undef = async (b: Uint8Array, format: string) =>
  (await decompressUtil.apply(b, { format, output: 'text' })) as string

const undefBytes = async (b: Uint8Array, format: string) =>
  (await decompressUtil.apply(b, { format, output: 'bytes' })) as Uint8Array

const toHex = (b: Uint8Array) => Array.from(b, (n) => n.toString(16).padStart(2, '0')).join('')

/** RFC 1950 §2.2: CM=8, CINFO<=7, and the CMF/FLG pair is a multiple of 31. */
const isZlibHeader = (b: Uint8Array) =>
  (b[0] & 0x0f) === 8 && b[0] >> 4 <= 7 && ((b[0] << 8) | b[1]) % 31 === 0

/** Compresses to a different size at different levels — see gzip_compress. */
const levelSample = JSON.stringify(
  Array.from({ length: 200 }, (_, i) => ({
    id: i,
    name: `user${i}`,
    tags: ['a', 'b', 'c'],
    active: i % 2 === 0
  }))
)

describe('deflate_compress', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('deflate_compress')
    expect(util.name).toBe('deflate compress')
    expect(util.category).toBe('Compression')
    expect(util.accepts).toEqual(['string', 'bytes'])
    expect(util.produces).toBe('bytes')
  })

  it('declares format and level params with the documented defaults', () => {
    const format = util.params.format
    expect(format.kind).toBe('select')
    expect(format.kind === 'select' ? format.options : null).toEqual(['raw', 'zlib'])
    expect(format.default).toBe('zlib')
    expect(util.params.level.kind).toBe('number')
    expect(util.params.level.default).toBe(6)
    expect(Object.keys(util.params).sort()).toEqual(['format', 'level'])
  })

  it('defaults to a zlib-wrapped stream', async () => {
    const source = 'The quick brown fox jumps over the lazy dog.'
    const out = await def(source)
    expect(out).toBeInstanceOf(Uint8Array)
    expect(isZlibHeader(out)).toBe(true)
    expect(await undef(out, 'zlib')).toBe(source)
  })

  it('produces the exact RFC 1950 / RFC 1951 streams for a known input', async () => {
    // Golden vectors for level 6, independently confirmed with node's zlib:
    //   zlib.inflateSync(Buffer.from(zlibHex, 'hex')).toString()    === 'Hello, zlib!'
    //   zlib.inflateRawSync(Buffer.from(rawHex, 'hex')).toString()  === 'Hello, raw deflate!'
    expect(toHex(await def('Hello, zlib!', { format: 'zlib' }))).toBe(
      '789cf348cdc9c9d751a8cac94c5204001b650413'
    )
    expect(toHex(await def('Hello, raw deflate!', { format: 'raw' }))).toBe(
      'f348cdc9c9d751284a2c5748494dcb492c49550400'
    )
  })

  it('emits a bare stream in raw format', async () => {
    const source = 'The quick brown fox jumps over the lazy dog.'
    const raw = await def(source, { format: 'raw' })
    const zlib = await def(source, { format: 'zlib' })
    expect(isZlibHeader(raw)).toBe(false)
    // zlib = 2-byte header + the same deflate stream + 4-byte adler32
    expect(zlib.length).toBe(raw.length + 6)
    expect(Array.from(zlib.slice(2, raw.length + 2))).toEqual(Array.from(raw))
    expect(await undef(raw, 'raw')).toBe(source)
  })

  it('actually shrinks repetitive input', async () => {
    const source = 'abcdefghij'.repeat(400)
    const out = await def(source)
    expect(out.length).toBeLessThan(source.length / 10)
    expect(await undef(out, 'auto')).toBe(source)
  })

  it('returns empty output for empty input', async () => {
    expect(await def('')).toEqual(new Uint8Array(0))
    expect(await def('', { format: 'raw' })).toEqual(new Uint8Array(0))
    expect(await def(new Uint8Array(0))).toEqual(new Uint8Array(0))
  })

  it('round-trips unicode, including astral characters', async () => {
    const source = 'héllo → 世界 🎉👩‍👩‍👧‍👦 ünïcödé'
    expect(await undef(await def(source, { format: 'zlib' }), 'zlib')).toBe(source)
    expect(await undef(await def(source, { format: 'raw' }), 'raw')).toBe(source)
  })

  it('round-trips arbitrary binary bytes exactly', async () => {
    const source = new Uint8Array(256)
    for (let i = 0; i < 256; i++) source[i] = 255 - i
    expect(await undefBytes(await def(source), 'auto')).toEqual(source)
    expect(await undefBytes(await def(source, { format: 'raw' }), 'auto')).toEqual(source)
  })

  it('stores rather than compresses at level 0', async () => {
    const source = 'compress me please '.repeat(200)
    const stored = await def(source, { level: 0 })
    const best = await def(source, { level: 9 })
    expect(stored.length).toBeGreaterThan(source.length)
    expect(best.length).toBeLessThan(stored.length)
    expect(await undef(stored, 'zlib')).toBe(source)
    expect(await undef(best, 'zlib')).toBe(source)
  })

  it('compresses harder as the level rises, and defaults to 6', async () => {
    const fastest = await def(levelSample, { level: 1 })
    const six = await def(levelSample, { level: 6 })
    const best = await def(levelSample, { level: 9 })
    expect(fastest.length).toBeGreaterThan(best.length)
    expect(six.length).toBeLessThanOrEqual(fastest.length)
    // omitting the param must behave exactly like the documented default
    expect(await def(levelSample)).toEqual(six)
    expect(await undef(fastest, 'auto')).toBe(levelSample)
    expect(await undef(best, 'auto')).toBe(levelSample)
  })

  it('applies the level to raw output too', async () => {
    const fastest = await def(levelSample, { format: 'raw', level: 1 })
    const best = await def(levelSample, { format: 'raw', level: 9 })
    expect(fastest.length).toBeGreaterThan(best.length)
    expect(await undef(best, 'raw')).toBe(levelSample)
  })

  it('accepts every level from 0 to 9', async () => {
    for (let level = 0; level <= 9; level++) {
      expect(await undef(await def('level check', { level }), 'auto')).toBe('level check')
      expect(await undef(await def('level check', { format: 'raw', level }), 'raw')).toBe(
        'level check'
      )
    }
  })

  it('rejects an out-of-range or non-integer level', async () => {
    await expect(util.apply('x', { level: 10 })).rejects.toThrow(/level must be/)
    await expect(util.apply('x', { level: -1 })).rejects.toThrow(/level must be/)
    await expect(util.apply('x', { level: 1.5 })).rejects.toThrow(/level must be/)
    await expect(util.apply('x', { level: 'max' })).rejects.toThrow(/level must be/)
  })
})
