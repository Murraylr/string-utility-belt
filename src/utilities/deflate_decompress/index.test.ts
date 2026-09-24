import { describe, it, expect } from 'vitest'
import util from './index'
import compressUtil from '../deflate_compress'
import gzipUtil from '../gzip_compress'

const def = async (input: unknown, format: string) =>
  (await compressUtil.apply(input as never, { format })) as Uint8Array

const text = async (input: unknown, params: Record<string, unknown> = {}) =>
  (await util.apply(input as never, { output: 'text', ...params })) as string

const bytes = async (input: unknown, params: Record<string, unknown> = {}) =>
  (await util.apply(input as never, { output: 'bytes', ...params })) as Uint8Array

const toHex = (b: Uint8Array) => Array.from(b, (n) => n.toString(16).padStart(2, '0')).join('')
const toLatin1 = (b: Uint8Array) => Array.from(b, (n) => String.fromCharCode(n)).join('')
const toBase64 = (b: Uint8Array) => btoa(toLatin1(b))
const fromBase64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))

/**
 * Streams produced by node's zlib — an implementation with no shared code with
 * fflate — so these assertions cannot be satisfied by a self-consistent but
 * non-standard codec. Generated with e.g.
 *   zlib.deflateSync(Buffer.from('Hello, zlib!'), { level: 9 }).toString('base64')
 *   zlib.deflateRawSync(Buffer.from('Hello, raw deflate!'), { level: 9 }).toString('base64')
 */
const NODE = {
  zlibHello: 'eNrzSM3JyddRqMrJTFIEABtlBBM=',
  rawHello: '80jNycnXUShKLFdISU3LSSxJVQQA',
  zlibUnicode: 'eNrLOLwyJydf4VHbJIUnO6Y9n9qj8GF+XycAiWcMVg=='
}

describe('deflate_decompress', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('deflate_decompress')
    expect(util.name).toBe('deflate decompress')
    expect(util.category).toBe('Compression')
    expect(util.accepts).toEqual(['string', 'bytes'])
    expect(util.produces).toEqual(['string', 'bytes'])
  })

  it('declares format and output params with the documented defaults', () => {
    const format = util.params.format
    expect(format.kind).toBe('select')
    expect(format.kind === 'select' ? format.options : null).toEqual(['auto', 'raw', 'zlib'])
    expect(format.default).toBe('auto')
    const output = util.params.output
    expect(output.kind).toBe('select')
    expect(output.kind === 'select' ? output.options : null).toEqual(['text', 'bytes'])
    expect(output.default).toBe('text')
    expect(Object.keys(util.params).sort()).toEqual(['format', 'output'])
  })

  it('decompresses streams produced by node zlib', async () => {
    expect(await text(fromBase64(NODE.zlibHello), { format: 'zlib' })).toBe('Hello, zlib!')
    expect(await text(fromBase64(NODE.rawHello), { format: 'raw' })).toBe('Hello, raw deflate!')
    expect(await text(fromBase64(NODE.zlibUnicode))).toBe('héllo → 世界 🎉')
    // and auto-detection picks the right wrapper for both
    expect(await text(fromBase64(NODE.zlibHello))).toBe('Hello, zlib!')
    expect(await text(fromBase64(NODE.rawHello))).toBe('Hello, raw deflate!')
  })

  it('decompresses a zlib-wrapped stream', async () => {
    const source = 'The quick brown fox jumps over the lazy dog.'
    expect(await text(await def(source, 'zlib'), { format: 'zlib' })).toBe(source)
  })

  it('decompresses a raw deflate stream', async () => {
    const source = 'The quick brown fox jumps over the lazy dog.'
    expect(await text(await def(source, 'raw'), { format: 'raw' })).toBe(source)
  })

  it('auto-detects both wrappers', async () => {
    const source = 'auto detection should just work'
    expect(await text(await def(source, 'zlib'), { format: 'auto' })).toBe(source)
    expect(await text(await def(source, 'raw'), { format: 'auto' })).toBe(source)
    // default params must behave like auto
    expect(await text(await def(source, 'raw'), {})).toBe(source)
    expect(await text(await def(source, 'zlib'), {})).toBe(source)
  })

  it('returns bytes when output is bytes', async () => {
    const source = new Uint8Array([0x00, 0x7f, 0x80, 0xff, 0x10])
    const out = await bytes(await def(source, 'zlib'))
    expect(out).toBeInstanceOf(Uint8Array)
    expect(out).toEqual(source)
    expect(await bytes(await def(source, 'raw'), { format: 'raw' })).toEqual(source)
  })

  it('returns empty output for empty input', async () => {
    expect(await text('')).toBe('')
    expect(await text(new Uint8Array(0), { format: 'raw' })).toBe('')
    expect(await text(new Uint8Array(0), { format: 'zlib' })).toBe('')
    expect(await bytes('')).toEqual(new Uint8Array(0))
  })

  it('round-trips unicode, including astral characters', async () => {
    const source = 'héllo → 世界 🎉 ünïcödé'
    expect(await text(await def(source, 'zlib'))).toBe(source)
    expect(await text(await def(source, 'raw'))).toBe(source)
  })

  it('accepts base64, hex and latin1 transports of a deflate stream', async () => {
    const source = 'transport encodings are handled'
    const packed = await def(source, 'zlib')
    expect(await text(toBase64(packed))).toBe(source)
    expect(await text(toHex(packed))).toBe(source)
    expect(await text(toLatin1(packed))).toBe(source)
  })

  it('throws a clear error on data that is not deflate', async () => {
    await expect(util.apply('this is plainly not deflate, sorry', {})).rejects.toThrow(
      /not valid deflate data/
    )
    await expect(util.apply(await def('hi', 'raw'), { format: 'zlib' })).rejects.toThrow(
      /not valid zlib data/
    )
  })

  it('detects corruption instead of returning wrong data', async () => {
    // fflate's unzlibSync never checks the Adler-32 trailer, so without an explicit
    // check these decompress to silently incorrect output.
    const source = 'the payload that must not be silently mangled'
    const packed = await def(source, 'zlib')

    const flippedAdler = packed.slice()
    flippedAdler[flippedAdler.length - 1] ^= 0xff
    await expect(util.apply(flippedAdler, {})).rejects.toThrow(/integrity check failed/)
    await expect(util.apply(flippedAdler, { format: 'zlib' })).rejects.toThrow(
      /integrity check failed/
    )

    const flippedPayload = packed.slice()
    flippedPayload[packed.length - 8] ^= 0x01
    await expect(util.apply(flippedPayload, {})).rejects.toThrow()

    // the untouched stream still decodes
    expect(await text(packed)).toBe(source)
  })

  it('points gzip input at the gzip utility', async () => {
    const packed = (await gzipUtil.apply('gzip, not deflate', {})) as Uint8Array
    await expect(util.apply(packed, { format: 'auto' })).rejects.toThrow(/gzip decompress/)
    await expect(util.apply(packed, { format: 'zlib' })).rejects.toThrow(/gzip decompress/)
    await expect(util.apply(toBase64(packed), { format: 'auto' })).rejects.toThrow(/gzip decompress/)
  })

  it('refuses to render binary payloads as text but returns them as bytes', async () => {
    const payload = new Uint8Array([0xff, 0xfe, 0xfd, 0xfc])
    const packed = await def(payload, 'zlib')
    await expect(util.apply(packed, { output: 'text' })).rejects.toThrow(/not valid UTF-8/)
    expect(await bytes(packed)).toEqual(payload)
  })
})
