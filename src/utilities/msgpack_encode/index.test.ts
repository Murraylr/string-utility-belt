import { describe, it, expect } from 'vitest'
import util from './index'
import { runPipeline } from '@/core/runner'

const run = async (input: unknown, params: Record<string, unknown> = {}) =>
  (await util.apply(input as never, params)) as Uint8Array

const bytes = (...b: number[]) => new Uint8Array(b)

describe('msgpack_encode', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('msgpack_encode')
    expect(util.name).toBe('msgpack encode')
    expect(util.category).toBe('Data Formats')
    expect(util.accepts).toBe('json')
    expect(util.produces).toBe('bytes')
    expect(util.params).toEqual({})
  })

  it('encodes a small map with the canonical bytes', async () => {
    expect(await run({ a: 1 })).toEqual(bytes(0x81, 0xa1, 0x61, 0x01))
    expect(await run({ compact: true, schema: 0 })).toEqual(
      bytes(0x82, 0xa7, 0x63, 0x6f, 0x6d, 0x70, 0x61, 0x63, 0x74, 0xc3, 0xa6, 0x73, 0x63, 0x68, 0x65, 0x6d, 0x61, 0x00)
    )
  })

  it('returns no bytes for empty input', async () => {
    expect(await run('')).toEqual(bytes())
    expect(await run('   ')).toEqual(bytes())
  })

  it('encodes nil, booleans and arrays', async () => {
    expect(await run(null)).toEqual(bytes(0xc0))
    expect(await run(true)).toEqual(bytes(0xc3))
    expect(await run(false)).toEqual(bytes(0xc2))
    expect(await run([1, 2, 3])).toEqual(bytes(0x93, 0x01, 0x02, 0x03))
  })

  it('picks the smallest integer encoding', async () => {
    expect(await run(0)).toEqual(bytes(0x00))
    expect(await run(127)).toEqual(bytes(0x7f))
    expect(await run(255)).toEqual(bytes(0xcc, 0xff))
    expect(await run(65535)).toEqual(bytes(0xcd, 0xff, 0xff))
    expect(await run(4294967295)).toEqual(bytes(0xce, 0xff, 0xff, 0xff, 0xff))
    expect(await run(-1)).toEqual(bytes(0xff))
    expect(await run(-32)).toEqual(bytes(0xe0))
    expect(await run(-33)).toEqual(bytes(0xd0, 0xdf))
    expect(await run(-32769)).toEqual(bytes(0xd2, 0xff, 0xff, 0x7f, 0xff))
  })

  it('encodes non-integers as float64', async () => {
    expect(await run(1.5)).toEqual(bytes(0xcb, 0x3f, 0xf8, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00))
  })

  it('encodes astral unicode as utf-8 str', async () => {
    expect(await run('😀')).toEqual(bytes(0xa4, 0xf0, 0x9f, 0x98, 0x80))
    expect(await run('héllo')).toEqual(bytes(0xa6, 0x68, 0xc3, 0xa9, 0x6c, 0x6c, 0x6f))
  })

  it('encodes raw bytes as bin', async () => {
    expect(await run(bytes(1, 2, 3))).toEqual(bytes(0xc4, 0x03, 0x01, 0x02, 0x03))
  })

  it('parses a JSON string, and falls back to plain text', async () => {
    expect(await run('{"a":1}')).toEqual(bytes(0x81, 0xa1, 0x61, 0x01))
    expect(await run('hi')).toEqual(bytes(0xa2, 0x68, 0x69))
  })

  it('does not parse a JSON string value a second time inside a pipeline', async () => {
    // the runner parses `"42"` to the string "42"; that must encode as str, not int 42
    const { out } = await runPipeline('"42"', [{ id: 's', utilityId: 'msgpack_encode', enabled: true, params: {} }],
      { load: () => util })
    expect(out).toEqual(bytes(0xa2, 0x34, 0x32))
  })

  it('uses str8 once a string is 32 bytes or longer', async () => {
    const s = 'x'.repeat(40)
    const out = await run(s)
    expect(out[0]).toBe(0xd9)
    expect(out[1]).toBe(40)
    expect(out.length).toBe(42)
    // fixstr holds up to 31 bytes, so 31 stays fixstr and 32 promotes
    expect((await run('x'.repeat(31)))[0]).toBe(0xbf)
    expect(Array.from((await run('x'.repeat(32))).slice(0, 2))).toEqual([0xd9, 32])
  })

  it('promotes arrays and maps past 15 entries to the 16-bit headers', async () => {
    expect((await run(new Array(15).fill(1)))[0]).toBe(0x9f)
    expect(Array.from((await run(new Array(16).fill(1))).slice(0, 3))).toEqual([0xdc, 0x00, 0x10])
    const small: Record<string, number> = {}
    for (let i = 0; i < 15; i++) small['k' + i] = 0
    expect((await run(small))[0]).toBe(0x8f)
    small.k15 = 0
    expect(Array.from((await run(small)).slice(0, 3))).toEqual([0xde, 0x00, 0x10])
  })

  it('throws on values it cannot encode', async () => {
    const circular: Record<string, unknown> = {}
    circular.self = circular
    await expect(run(circular)).rejects.toThrow(/circular/)
    await expect(run(10n ** 30n)).rejects.toThrow(/too large/)
  })
})
