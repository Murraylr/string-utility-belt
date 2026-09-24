import { describe, it, expect } from 'vitest'
import util from './index'

describe('binary_encode', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('binary_encode')
    expect(util.name).toBe('binary encode')
    expect(util.category).toBe('Encoding')
    expect(util.accepts).toEqual(['string', 'bytes'])
    expect(util.produces).toBe('string')
    expect(Object.keys(util.params).sort()).toEqual(['bits', 'groupBytes', 'separator'])
  })

  it('encodes ascii text as 8-bit groups', async () => {
    expect(await util.apply('Hi', {})).toBe('01001000 01101001')
    expect(await util.apply('A', {})).toBe('01000001')
  })

  it('returns empty string for empty input', async () => {
    expect(await util.apply('', {})).toBe('')
    expect(await util.apply(new Uint8Array([]), {})).toBe('')
  })

  it('encodes non-ascii text as its utf-8 bytes', async () => {
    expect(await util.apply('é', {})).toBe('11000011 10101001')
    // astral character: one code point, four utf-8 bytes
    expect(await util.apply('😀', {})).toBe('11110000 10011111 10011000 10000000')
  })

  it('supports 7-bit groups', async () => {
    expect(await util.apply('Hi', { bits: '8' })).toBe('01001000 01101001')
    expect(await util.apply('Hi', { bits: '7' })).toBe('1001000 1101001')
    expect(await util.apply('~', { bits: '7' })).toBe('1111110')
  })

  it('throws when a byte does not fit in 7 bits', () => {
    expect(() => util.apply('é', { bits: '7' })).toThrow(/7 bits/)
  })

  it('honours the separator, including escapes and the empty string', async () => {
    expect(await util.apply('Hi', { separator: '-' })).toBe('01001000-01101001')
    expect(await util.apply('Hi', { separator: '' })).toBe('0100100001101001')
    expect(await util.apply('Hi', { separator: '\\n' })).toBe('01001000\n01101001')
  })

  it('groups multiple bytes per separator', async () => {
    expect(await util.apply('Hi!', { groupBytes: 2 })).toBe('0100100001101001 00100001')
    expect(await util.apply('Hi!', { groupBytes: 0 })).toBe('010010000110100100100001')
    expect(await util.apply('Hi!', { groupBytes: 3 })).toBe('010010000110100100100001')
  })

  it('encodes raw bytes', async () => {
    expect(await util.apply(new Uint8Array([0, 255]), {})).toBe('00000000 11111111')
  })
})
