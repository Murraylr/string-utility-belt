import { describe, it, expect } from 'vitest'
import util from './index'

const run = async (input: unknown, params: Record<string, unknown> = {}) =>
  await util.apply(input as never, params)

const bytes = (...b: number[]) => new Uint8Array(b)

describe('protobuf_decode', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('protobuf_decode')
    expect(util.name).toBe('protobuf wire decode')
    expect(util.category).toBe('Data Formats')
    expect(util.accepts).toEqual(['string', 'bytes'])
    expect(util.produces).toBe('json')
    expect(util.params).toEqual({})
  })

  it('decodes varint fields', async () => {
    expect(await run(bytes(0x08, 0x96, 0x01))).toEqual([{ field: 1, wireType: 0, value: 150 }])
    expect(await run(bytes(0x08, 0x01, 0x10, 0x02))).toEqual([
      { field: 1, wireType: 0, value: 1 },
      { field: 2, wireType: 0, value: 2 }
    ])
  })

  it('returns an empty list for empty input', async () => {
    expect(await run('')).toEqual([])
    expect(await run(bytes())).toEqual([])
    expect(await run('   ')).toEqual([])
  })

  it('reads length-delimited fields as text when they are printable', async () => {
    const testing = bytes(0x12, 0x07, 0x74, 0x65, 0x73, 0x74, 0x69, 0x6e, 0x67)
    expect(await run(testing)).toEqual([{ field: 2, wireType: 2, value: 'testing' }])
  })

  it('keeps astral unicode text intact', async () => {
    const payload = new TextEncoder().encode('héllo 😀')
    const buf = new Uint8Array([0x0a, payload.length, ...payload])
    expect(await run(buf)).toEqual([{ field: 1, wireType: 2, value: 'héllo 😀' }])
  })

  it('recurses into nested messages and falls back to hex', async () => {
    expect(await run(bytes(0x1a, 0x03, 0x08, 0x96, 0x01))).toEqual([
      { field: 3, wireType: 2, value: [{ field: 1, wireType: 0, value: 150 }] }
    ])
    expect(await run(bytes(0x0a, 0x02, 0xff, 0xfe))).toEqual([{ field: 1, wireType: 2, value: 'fffe' }])
    expect(await run(bytes(0x0a, 0x00))).toEqual([{ field: 1, wireType: 2, value: '' }])
  })

  it('decodes 32-bit and 64-bit fields', async () => {
    expect(await run(bytes(0x25, 0x00, 0x00, 0xc0, 0x3f))).toEqual([
      { field: 4, wireType: 5, value: { uint32: 1069547520, int32: 1069547520, float: 1.5 } }
    ])
    expect(await run(bytes(0x29, 0, 0, 0, 0, 0, 0, 0xf8, 0x3f))).toEqual([
      {
        field: 5,
        wireType: 1,
        // beyond Number.MAX_SAFE_INTEGER, so the integer views stay exact as strings
        value: { uint64: '4609434218613702656', int64: '4609434218613702656', double: 1.5 }
      }
    ])
  })

  it('decodes deprecated groups', async () => {
    // field 1 start-group, inner field 2 varint 7, field 1 end-group
    expect(await run(bytes(0x0b, 0x10, 0x07, 0x0c))).toEqual([
      { field: 1, wireType: 3, value: [{ field: 2, wireType: 0, value: 7 }] }
    ])
  })

  it('auto-detects hex and base64 string input', async () => {
    const expected = [{ field: 1, wireType: 0, value: 150 }]
    expect(await run('089601')).toEqual(expected)
    expect(await run('08 96 01')).toEqual(expected)
    expect(await run('CJYB')).toEqual(expected)
    expect(await run('CAE=')).toEqual([{ field: 1, wireType: 0, value: 1 }])
  })

  it('keeps 64-bit varints exact', async () => {
    // field 1, varint 18446744073709551615
    expect(await run(bytes(0x08, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0x01))).toEqual([
      { field: 1, wireType: 0, value: '18446744073709551615' }
    ])
  })

  it('prefers text over a payload that only accidentally parses as a message', async () => {
    // "hi" is also a well-formed message (field 13, varint 105); text wins
    expect(await run(bytes(0x0a, 0x02, 0x68, 0x69))).toEqual([{ field: 1, wireType: 2, value: 'hi' }])
  })

  it('rejects varints and tags that cannot be represented', async () => {
    // 10th byte carries bit 63 only: 0x7f there is past 2^64
    await expect(run(bytes(0x08, ...new Array(9).fill(0xff), 0x7f))).rejects.toThrow(/overflows 64 bits/)
    // tag 8589934591 >> 3 exceeds the 2^29-1 field-number limit
    await expect(run(bytes(0xff, 0xff, 0xff, 0xff, 0xff, 0x01, 0x00))).rejects.toThrow(/invalid field number/)
  })

  it('throws on malformed wire data', async () => {
    await expect(run(bytes(0x08))).rejects.toThrow(/truncated varint/)
    await expect(run(bytes(0x00, 0x01))).rejects.toThrow(/invalid field number/)
    await expect(run(bytes(0x0e, 0x01))).rejects.toThrow(/invalid wire type/)
    await expect(run(bytes(0x0a, 0x05, 0x01))).rejects.toThrow(/runs past the end/)
    await expect(run('not protobuf!!')).rejects.toThrow(/hex \/ base64/)
  })
})
