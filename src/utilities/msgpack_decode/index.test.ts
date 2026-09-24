import { describe, it, expect } from 'vitest'
import util from './index'
import msgpackEncode from '../msgpack_encode'

const run = async (input: unknown, params: Record<string, unknown> = {}) =>
  await util.apply(input as never, params)

const bytes = (...b: number[]) => new Uint8Array(b)
const encode = async (value: unknown) => (await msgpackEncode.apply(value as never, {})) as Uint8Array

describe('msgpack_decode', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('msgpack_decode')
    expect(util.name).toBe('msgpack decode')
    expect(util.category).toBe('Data Formats')
    expect(util.accepts).toBe('bytes')
    expect(util.produces).toBe('json')
    expect(util.params).toEqual({})
  })

  it('decodes maps, arrays and scalars', async () => {
    expect(await run(bytes(0x81, 0xa1, 0x61, 0x01))).toEqual({ a: 1 })
    expect(await run(bytes(0x93, 0x01, 0x02, 0x03))).toEqual([1, 2, 3])
    expect(await run(bytes(0xc0))).toBe(null)
    expect(await run(bytes(0xc3))).toBe(true)
    expect(await run(bytes(0xff))).toBe(-1)
  })

  it('returns empty output for empty input', async () => {
    expect(await run(bytes())).toBe('')
    expect(await run('')).toBe('')
  })

  it('decodes astral unicode strings', async () => {
    expect(await run(bytes(0xa4, 0xf0, 0x9f, 0x98, 0x80))).toBe('😀')
    expect(await run(bytes(0xda, 0x00, 0x02, 0x68, 0x69))).toBe('hi')
  })

  it('keeps a string value that starts with U+FEFF intact', async () => {
    // each str is its own UTF-8 payload, not a document: a leading EF BB BF is content, not a byte-order mark
    const zwnbsp = String.fromCharCode(0xfeff)
    expect(await run(bytes(0xa4, 0xef, 0xbb, 0xbf, 0x61))).toBe(zwnbsp + 'a')
    expect(await run(bytes(0x81, 0xa1, 0x6b, 0xa3, 0xef, 0xbb, 0xbf))).toEqual({ k: zwnbsp })
  })

  it('decodes floats and wide integers exactly', async () => {
    expect(await run(bytes(0xca, 0x3f, 0xc0, 0x00, 0x00))).toBe(1.5)
    expect(await run(bytes(0xcb, 0x3f, 0xf8, 0, 0, 0, 0, 0, 0))).toBe(1.5)
    expect(await run(bytes(0xcf, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff))).toBe('18446744073709551615')
    expect(await run(bytes(0xd3, 0x80, 0, 0, 0, 0, 0, 0, 0))).toBe('-9223372036854775808')
    expect(await run(bytes(0xcf, 0, 0, 0, 0, 0, 0, 0, 0x2a))).toBe(42)
  })

  it('decodes bin payloads to bytes and ext types to { type, data }', async () => {
    expect(await run(bytes(0xc4, 0x03, 0x01, 0x02, 0x03))).toEqual(bytes(1, 2, 3))
    expect(await run(bytes(0xd4, 0x05, 0x01))).toEqual({ type: 5, data: '01' })
    expect(await run(bytes(0xc7, 0x02, 0xff, 0xaa, 0xbb))).toEqual({ type: -1, data: 'aabb' })
  })

  it('stringifies non-string map keys', async () => {
    expect(await run(bytes(0x81, 0x01, 0xc3))).toEqual({ '1': true })
  })

  it('keeps a __proto__ map key as an ordinary key', async () => {
    // fixmap(1) fixstr(9) "__proto__" 1
    const buf = bytes(0x81, 0xa9, 0x5f, 0x5f, 0x70, 0x72, 0x6f, 0x74, 0x6f, 0x5f, 0x5f, 0x01)
    const out = (await run(buf)) as Record<string, unknown>
    expect(Object.keys(out)).toEqual(['__proto__'])
    expect(Object.getOwnPropertyDescriptor(out, '__proto__')?.value).toBe(1)
    expect(Object.getPrototypeOf(out)).toBe(Object.prototype)
    expect(JSON.stringify(out)).toBe('{"__proto__":1}')
  })

  it('decodes the 16-bit array and map headers', async () => {
    expect(await run(bytes(0xdc, 0x00, 0x02, 0x01, 0x02))).toEqual([1, 2])
    expect(await run(bytes(0xde, 0x00, 0x01, 0xa1, 0x61, 0x01))).toEqual({ a: 1 })
  })

  it('round-trips values produced by msgpack_encode', async () => {
    const value = {
      name: 'José 😀',
      nums: [1, -2, 3.5],
      ok: true,
      nil: null,
      nested: { 'ключ': 'значение ✓' }
    }
    expect(await run(await encode(value))).toEqual(value)
    expect(await run(await encode('😀 héllo'))).toBe('😀 héllo')
    expect(await run(await encode(bytes(0, 255, 128)))).toEqual(bytes(0, 255, 128))
  })

  it('throws on malformed input', async () => {
    await expect(run(bytes(0xc0, 0xc0))).rejects.toThrow(/trailing data/)
    await expect(run(bytes(0xc1))).rejects.toThrow(/reserved/)
    await expect(run(bytes(0xa2, 0x68))).rejects.toThrow(/truncated/)
    await expect(run(bytes(0xa1, 0xff))).rejects.toThrow(/invalid UTF-8/)
  })
})
