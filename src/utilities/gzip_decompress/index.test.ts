import { describe, it, expect } from 'vitest'
import util from './index'
import compressUtil from '../gzip_compress'

const gz = async (input: unknown) => (await compressUtil.apply(input as never, {})) as Uint8Array

const text = async (input: unknown, params: Record<string, unknown> = {}) =>
  (await util.apply(input as never, { output: 'text', ...params })) as string

const bytes = async (input: unknown, params: Record<string, unknown> = {}) =>
  (await util.apply(input as never, { output: 'bytes', ...params })) as Uint8Array

const toHex = (b: Uint8Array) => Array.from(b, (n) => n.toString(16).padStart(2, '0')).join('')
const toLatin1 = (b: Uint8Array) => Array.from(b, (n) => String.fromCharCode(n)).join('')
const toBase64 = (b: Uint8Array) => btoa(toLatin1(b))
const fromBase64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))
const concat = (...parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let at = 0
  for (const p of parts) {
    out.set(p, at)
    at += p.length
  }
  return out
}

/**
 * Streams produced by node's zlib — an implementation with no shared code with
 * fflate — so these assertions cannot be satisfied by a self-consistent but
 * non-standard codec. Generated with e.g.
 *   zlib.gzipSync(Buffer.from('Hello, gzip!'), { level: 9 }).toString('base64')
 */
const NODE = {
  hello: 'H4sIAAAAAAACCvNIzcnJ11FIr8osUAQAPj0PEAwAAAA=',
  unicode: 'H4sIAAAAAAACCss4vDInJ1/hUdskhSc7pj2f2qPwYX5fJwDxKb5oFgAAAA==',
  highBytes: 'H4sIAAAAAAAACmOob/gvAABBsdiaBQAAAA==',
  empty: 'H4sIAAAAAAAACgMAAAAAAAAAAAA=',
  // two members concatenated: gzip('part one, ') + gzip('part two')
  multiMember:
    'H4sIAAAAAAAACitILCpRyM9L1VEAAOs9/SMKAAAAH4sIAAAAAAAACitILCpRKCnPBwAnH7LgCAAAAA=='
}

describe('gzip_decompress', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('gzip_decompress')
    expect(util.name).toBe('gzip decompress')
    expect(util.category).toBe('Compression')
    expect(util.accepts).toEqual(['string', 'bytes'])
    expect(util.produces).toEqual(['string', 'bytes'])
  })

  it('declares an output param defaulting to text', () => {
    const output = util.params.output
    expect(output.kind).toBe('select')
    expect(output.kind === 'select' ? output.options : null).toEqual(['text', 'bytes'])
    expect(output.default).toBe('text')
    expect(Object.keys(util.params)).toEqual(['output'])
  })

  it('decompresses a gzip stream produced by node zlib', async () => {
    expect(await text(fromBase64(NODE.hello))).toBe('Hello, gzip!')
    expect(await text(fromBase64(NODE.unicode))).toBe('héllo → 世界 🎉')
    expect(await bytes(fromBase64(NODE.highBytes))).toEqual(
      new Uint8Array([0x00, 0x7f, 0x80, 0xff, 0x10])
    )
    // a gzip stream whose payload is empty is a 20-byte stream, not empty input
    expect(fromBase64(NODE.empty).length).toBe(20)
    expect(await text(fromBase64(NODE.empty))).toBe('')
  })

  it('decompresses every member of a concatenated gzip file', async () => {
    // `cat a.gz b.gz` is a legal gzip file (RFC 1952 §2.2); dropping the tail would
    // be silent data loss.
    expect(await text(fromBase64(NODE.multiMember))).toBe('part one, part two')
    expect(await text(concat(await gz('alpha '), await gz('beta '), await gz('gamma')))).toBe(
      'alpha beta gamma'
    )
  })

  it('decompresses gzip bytes back to text', async () => {
    const source = 'The quick brown fox jumps over the lazy dog.'
    expect(await text(await gz(source))).toBe(source)
  })

  it('returns bytes when output is bytes', async () => {
    const source = new Uint8Array([0x00, 0x7f, 0x80, 0xff, 0x10])
    const out = await bytes(await gz(source))
    expect(out).toBeInstanceOf(Uint8Array)
    expect(out).toEqual(source)
  })

  it('returns empty output for empty input', async () => {
    expect(await text('')).toBe('')
    expect(await text(new Uint8Array(0))).toBe('')
    expect(await bytes('')).toEqual(new Uint8Array(0))
  })

  it('round-trips unicode, including astral characters', async () => {
    const source = 'héllo → 世界 🎉 ünïcödé'
    expect(await text(await gz(source))).toBe(source)
  })

  it('accepts base64, hex and latin1 transports of a gzip stream', async () => {
    const source = 'transport encodings are handled'
    const packed = await gz(source)
    expect(await text(toBase64(packed))).toBe(source)
    expect(await text(toHex(packed))).toBe(source)
    expect(await text(toLatin1(packed))).toBe(source)
  })

  it('throws a clear error on data that is not gzip', async () => {
    await expect(util.apply('this is plainly not gzip, sorry', {})).rejects.toThrow(
      /not valid gzip data/
    )
    await expect(util.apply(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]), {})).rejects.toThrow(
      /not valid gzip data/
    )
  })

  it('calls a few bytes of non-gzip input not gzip, never damaged gzip', async () => {
    // the streaming reader waits for a whole header before checking it, so these once
    // reached the trailer check and were reported as a failed CRC-32
    for (const input of ['{', '[', '}', '{"a":1}', new Uint8Array([0x7b])]) {
      const error = await Promise.resolve(util.apply(input as never, {})).then(() => null, (e: Error) => e.message)
      expect(error).toMatch(/^not valid gzip data/)
      expect(error).not.toMatch(/integrity/)
    }
  })

  it('says a gzip header cut off before a whole stream is too short to be gzip', async () => {
    // H4sIAAAA is Base64 for 1f 8b 08 00 00 00: the start of every CloudWatch Logs payload
    await expect(util.apply('H4sIAAAA', {})).rejects.toThrow(
      /^not valid gzip data .*: only 6 bytes, and the shortest gzip stream is 20$/
    )
    const full = await gz('short')
    await expect(util.apply(full.slice(0, 19), {})).rejects.toThrow(/only 19 bytes/)
  })

  it('throws on truncated gzip data', async () => {
    const full = await gz('a reasonably long sentence to compress and then truncate')
    await expect(util.apply(full.slice(0, full.length - 6), {})).rejects.toThrow()
    await expect(util.apply(full.slice(0, 12), {})).rejects.toThrow()
  })

  it('detects corruption instead of returning wrong data', async () => {
    // fflate's gunzipSync ignores the CRC-32/ISIZE trailer entirely, so without an
    // explicit check these all decompress to silently incorrect output.
    const source = 'the payload that must not be silently mangled'
    const full = await gz(source)

    const flippedCrc = full.slice()
    flippedCrc[flippedCrc.length - 8] ^= 0xff
    await expect(util.apply(flippedCrc, {})).rejects.toThrow(/integrity check failed/)

    const flippedSize = full.slice()
    flippedSize[flippedSize.length - 4] ^= 0x01
    await expect(util.apply(flippedSize, {})).rejects.toThrow(/integrity check failed/)

    const flippedPayload = full.slice()
    flippedPayload[full.length - 12] ^= 0x01
    await expect(util.apply(flippedPayload, {})).rejects.toThrow(/integrity check failed/)

    // trailing junk after a complete member is not a valid gzip file either
    await expect(util.apply(concat(full, new Uint8Array(8)), {})).rejects.toThrow()

    // and the untouched stream still decodes
    expect(await text(full)).toBe(source)
  })

  it('refuses to render binary payloads as text but returns them as bytes', async () => {
    const payload = new Uint8Array([0xff, 0xfe, 0xfd, 0xfc])
    const packed = await gz(payload)
    await expect(util.apply(packed, { output: 'text' })).rejects.toThrow(/not valid UTF-8/)
    expect(await bytes(packed)).toEqual(payload)
  })
})
