import { describe, it, expect } from 'vitest'
import util from './index'
import encoder from '../binary_encode/index'

describe('binary_decode', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('binary_decode')
    expect(util.name).toBe('binary decode')
    expect(util.category).toBe('Decoding')
    expect(util.accepts).toBe('string')
    expect(util.produces).toEqual(['string', 'bytes'])
    expect(Object.keys(util.params).sort()).toEqual(['bits', 'output'])
  })

  it('decodes 8-bit groups to text', async () => {
    expect(await util.apply('01001000 01101001', {})).toBe('Hi')
  })

  it('returns the empty value for empty input', async () => {
    expect(await util.apply('', {})).toBe('')
    expect(await util.apply('   ', {})).toBe('')
    expect(await util.apply('', { output: 'bytes' })).toEqual(new Uint8Array([]))
  })

  it('ignores whitespace, punctuation and 0b prefixes', async () => {
    expect(await util.apply('0100-1000,0110.1001', {})).toBe('Hi')
    expect(await util.apply('0b01001000 0b01101001', {})).toBe('Hi')
    expect(await util.apply('0100100001101001', {})).toBe('Hi')
  })

  it('ignores any separator the encoder can emit, not just a punctuation whitelist', async () => {
    expect(await util.apply('01001000 => 01101001', {})).toBe('Hi')
    expect(await util.apply('01001000 · 01101001', {})).toBe('Hi')
    expect(await util.apply('01001000—01101001', {})).toBe('Hi')
    expect(await util.apply('01001000\t01101001', {})).toBe('Hi')
    expect(await util.apply('01001000+01101001', {})).toBe('Hi')
  })

  it('decodes 7-bit groups', async () => {
    expect(await util.apply('1001000 1101001', { bits: '7' })).toBe('Hi')
  })

  it('can output raw bytes', async () => {
    expect(await util.apply('11111111 00000000', { output: 'bytes' })).toEqual(new Uint8Array([255, 0]))
  })

  it('throws on invalid digits, bad bit counts and non-utf-8 text output', () => {
    expect(() => util.apply('0102', {})).toThrow(/unexpected character "2"/)
    expect(() => util.apply('hello', {})).toThrow(/unexpected character "h"/)
    // a stray letter is junk, not a separator, even outside ASCII
    expect(() => util.apply('01001000é', {})).toThrow(/unexpected character "é"/)
    expect(() => util.apply('0100100', {})).toThrow(/not a multiple of 8/)
    expect(() => util.apply('01001000 0110100', { bits: '7' })).toThrow(/not a multiple of 7/)
    expect(() => util.apply('11111111', {})).toThrow(/not valid UTF-8/)
  })

  it('round-trips unicode and raw bytes through binary_encode', async () => {
    const text = 'Grüße 😀 — ok'
    expect(await util.apply(await encoder.apply(text, {}) as string, {})).toBe(text)
    expect(await util.apply(await encoder.apply(text, { separator: '' }) as string, {})).toBe(text)
    expect(await util.apply(await encoder.apply('Hi', { bits: '7' }) as string, { bits: '7' })).toBe('Hi')

    const bytes = new Uint8Array([0, 1, 127, 128, 254, 255])
    expect(await util.apply(await encoder.apply(bytes, {}) as string, { output: 'bytes' })).toEqual(bytes)
  })

  it('round-trips every separator and grouping the encoder offers', async () => {
    const bytes = new Uint8Array([0, 1, 65, 127, 128, 200, 254, 255])
    for (const separator of [' ', '', '-', ', ', ' | ', ' => ', ' · ', ' — ', '_', '+']) {
      for (const groupBytes of [0, 1, 3]) {
        const encoded = await encoder.apply(bytes, { separator, groupBytes }) as string
        expect({ separator, groupBytes, out: await util.apply(encoded, { output: 'bytes' }) })
          .toEqual({ separator, groupBytes, out: bytes })
      }
    }
  })
})
