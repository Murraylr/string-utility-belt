import { describe, it, expect } from 'vitest'
import util from './index'
import charsetEncode from '../charset_encode/index'

const BOM = '﻿'
const bytes = (...b: number[]) => new Uint8Array(b)
const arr = async (input: unknown, params: Record<string, unknown>) =>
  Array.from((await util.apply(input as never, params)) as Uint8Array)

describe('bom', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('bom')
    expect(util.name).toBe('byte order mark')
    expect(util.category).toBe('Encoding')
    expect(util.accepts).toEqual(['string', 'bytes'])
    expect(util.produces).toEqual(['string', 'bytes', 'json'])
    expect(util.params.mode.default).toBe('detect')
    expect(util.params.encoding.default).toBe('utf-8')
    expect((util.params.mode as { options: string[] }).options).toEqual(['detect', 'add', 'remove'])
    expect((util.params.encoding as { options: string[] }).options).toEqual([
      'utf-8',
      'utf-16le',
      'utf-16be'
    ])
  })

  it('detects every byte order mark', async () => {
    expect(await util.apply(bytes(0xef, 0xbb, 0xbf, 0x68, 0x69), { mode: 'detect' })).toEqual({
      found: true,
      encoding: 'utf-8',
      bytes: 'EF BB BF'
    })
    expect(await util.apply(bytes(0xff, 0xfe, 0x68, 0x00), { mode: 'detect' })).toEqual({
      found: true,
      encoding: 'utf-16le',
      bytes: 'FF FE'
    })
    expect(await util.apply(bytes(0xfe, 0xff, 0x00, 0x68), { mode: 'detect' })).toEqual({
      found: true,
      encoding: 'utf-16be',
      bytes: 'FE FF'
    })
    // the utf-32le mark starts with the utf-16le mark, so order matters
    expect(await util.apply(bytes(0xff, 0xfe, 0x00, 0x00), { mode: 'detect' })).toEqual({
      found: true,
      encoding: 'utf-32le',
      bytes: 'FF FE 00 00'
    })
    expect(await util.apply(bytes(0x00, 0x00, 0xfe, 0xff), { mode: 'detect' })).toEqual({
      found: true,
      encoding: 'utf-32be',
      bytes: '00 00 FE FF'
    })
  })

  it('detects with the default params (mode = detect)', async () => {
    expect(await util.apply(BOM + 'hi', {})).toEqual({
      found: true,
      encoding: 'utf-8',
      bytes: 'EF BB BF'
    })
    expect(await util.apply(bytes(0x68), {})).toEqual({ found: false, encoding: null, bytes: '' })
  })

  it('reports no mark when there is none, including for empty input', async () => {
    const none = { found: false, encoding: null, bytes: '' }
    expect(await util.apply('hello', { mode: 'detect' })).toEqual(none)
    expect(await util.apply('', { mode: 'detect' })).toEqual(none)
    expect(await util.apply(new Uint8Array(0), { mode: 'detect' })).toEqual(none)
    // a truncated mark is not a mark
    expect(await util.apply('ï»', { mode: 'detect' })).toEqual(none)
    expect(await util.apply(bytes(0xef, 0xbb), { mode: 'detect' })).toEqual(none)
    expect(await util.apply(bytes(0xff), { mode: 'detect' })).toEqual(none)
  })

  it('detects a mark in text, including a mark pasted as raw latin-1 bytes', async () => {
    expect(await util.apply(BOM + 'hello', { mode: 'detect' })).toEqual({
      found: true,
      encoding: 'utf-8',
      bytes: 'EF BB BF'
    })
    expect(await util.apply('ï»¿hello', { mode: 'detect' })).toEqual({
      found: true,
      encoding: 'utf-8',
      bytes: 'EF BB BF'
    })
    expect(await util.apply('þÿhello', { mode: 'detect' })).toEqual({
      found: true,
      encoding: 'utf-16be',
      bytes: 'FE FF'
    })
  })

  it('detects a byte-view mark followed immediately by astral text', async () => {
    // regression: a code unit above 0xFF after the mark must not abort detection
    expect(await util.apply('ï»¿😀hi', { mode: 'detect' })).toEqual({
      found: true,
      encoding: 'utf-8',
      bytes: 'EF BB BF'
    })
    expect(await util.apply('ÿþ😀', { mode: 'detect' })).toEqual({
      found: true,
      encoding: 'utf-16le',
      bytes: 'FF FE'
    })
    expect(await util.apply('ï»¿😀hi', { mode: 'remove' })).toBe('😀hi')
    // the mark itself may be astral-adjacent without being a mark
    expect(await util.apply('😀ï»¿', { mode: 'detect' })).toEqual({
      found: false,
      encoding: null,
      bytes: ''
    })
  })

  it('adds a mark and stays idempotent', async () => {
    expect(await util.apply('hi 😀', { mode: 'add' })).toBe(BOM + 'hi 😀')
    expect(await util.apply(BOM + 'hi', { mode: 'add' })).toBe(BOM + 'hi')
    expect(await arr(bytes(0x68, 0x69), { mode: 'add', encoding: 'utf-8' })).toEqual([
      0xef, 0xbb, 0xbf, 0x68, 0x69
    ])
    expect(await arr(bytes(0x68, 0x00), { mode: 'add', encoding: 'utf-16le' })).toEqual([
      0xff, 0xfe, 0x68, 0x00
    ])
    expect(await arr(bytes(0x00, 0x68), { mode: 'add', encoding: 'utf-16be' })).toEqual([
      0xfe, 0xff, 0x00, 0x68
    ])
    // an existing mark is replaced rather than doubled
    expect(await arr(bytes(0xef, 0xbb, 0xbf, 0x68), { mode: 'add', encoding: 'utf-16be' })).toEqual([
      0xfe, 0xff, 0x68
    ])
    expect(await util.apply('', { mode: 'add' })).toBe(BOM)
  })

  it('adds a character-level mark that encodes correctly in every encoding', async () => {
    // at character level the mark is U+FEFF whatever the target encoding; the
    // `encoding` param only picks the bytes, which is the bytes input path
    const marked = (await util.apply('hi', { mode: 'add', encoding: 'utf-16le' })) as string
    expect(marked).toBe(BOM + 'hi')
    expect(Array.from((await charsetEncode.apply(marked, { charset: 'utf-16le' })) as Uint8Array))
      .toEqual([0xff, 0xfe, 0x68, 0x00, 0x69, 0x00])
    expect(Array.from((await charsetEncode.apply(marked, { charset: 'utf-16be' })) as Uint8Array))
      .toEqual([0xfe, 0xff, 0x00, 0x68, 0x00, 0x69])
    expect(Array.from((await charsetEncode.apply(marked, { charset: 'utf-8' })) as Uint8Array))
      .toEqual([0xef, 0xbb, 0xbf, 0x68, 0x69])
  })

  it('removes whichever mark is present and leaves clean input alone', async () => {
    expect(await util.apply(BOM + 'héllo 😀', { mode: 'remove' })).toBe('héllo 😀')
    expect(await util.apply('héllo', { mode: 'remove' })).toBe('héllo')
    expect(await util.apply('ï»¿hi', { mode: 'remove' })).toBe('hi')
    expect(await arr(bytes(0xff, 0xfe, 0x68, 0x00), { mode: 'remove' })).toEqual([0x68, 0x00])
    expect(await arr(bytes(0x00, 0x00, 0xfe, 0xff, 0x41), { mode: 'remove' })).toEqual([0x41])
    expect(await arr(bytes(0x68, 0x69), { mode: 'remove' })).toEqual([0x68, 0x69])
    expect(await util.apply('', { mode: 'remove' })).toBe('')
    // removing twice is a no-op, and detect then reports nothing
    const once = (await util.apply(BOM + 'x', { mode: 'remove' })) as string
    expect(await util.apply(once, { mode: 'remove' })).toBe('x')
    expect(await util.apply(once, { mode: 'detect' })).toEqual({
      found: false,
      encoding: null,
      bytes: ''
    })
  })

  it('round-trips add -> detect -> remove for every encoding', async () => {
    for (const encoding of ['utf-8', 'utf-16le', 'utf-16be']) {
      const body = bytes(0x41, 0x42, 0x43)
      const added = (await util.apply(body, { mode: 'add', encoding })) as Uint8Array
      expect(await util.apply(added, { mode: 'detect' })).toEqual({
        found: true,
        encoding,
        bytes: encoding === 'utf-8' ? 'EF BB BF' : encoding === 'utf-16le' ? 'FF FE' : 'FE FF'
      })
      expect(await arr(added, { mode: 'remove' })).toEqual([0x41, 0x42, 0x43])
    }
  })

  it('rejects unknown modes and encodings', () => {
    expect(() => util.apply('hi', { mode: 'explode' })).toThrow(/unknown mode/)
    expect(() => util.apply('hi', { mode: 'add', encoding: 'utf-32le' })).toThrow(
      /unknown bom encoding/
    )
    // encoding is only consulted by add, so detect/remove tolerate anything
    expect(() => util.apply('hi', { mode: 'detect', encoding: 'utf-32le' })).not.toThrow()
  })
})
