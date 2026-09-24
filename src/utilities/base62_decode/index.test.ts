import { describe, it, expect } from 'vitest'
import util from './index'
import encoder from '../base62_encode/index'

const hex = (h: string) => new Uint8Array((h.match(/../g) || []).map(x => parseInt(x, 16)))

describe('base62_decode', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('base62_decode')
    expect(util.name).toBe('base62 decode')
    expect(util.category).toBe('Decoding')
    expect(util.accepts).toBe('string')
    expect(util.produces).toEqual(['string', 'bytes'])
  })

  it('decodes standard-alphabet Base62', async () => {
    expect(await util.apply('5TP3P3v', {})).toBe('Hello')
    expect(await util.apply('6x7', {})).toBe('hi')
    expect(await util.apply('1wJfrzvdbtXUOlUjUf', {})).toBe('Hello, World!')
  })

  it('returns empty output for empty input', async () => {
    expect(await util.apply('', {})).toBe('')
    expect(await util.apply(' \n\t ', {})).toBe('')
    expect(await util.apply('', { output: 'bytes' })).toEqual(new Uint8Array([]))
  })

  it('decodes non-ASCII text back to UTF-8', async () => {
    expect(await util.apply('7VuRskb', {})).toBe('café')
    expect(await util.apply('4PCnw0', {})).toBe('🚀')
  })

  it('supports the inverted alphabet', async () => {
    expect(await util.apply('5tp3p3V', { alphabet: 'inverted' })).toBe('Hello')
    expect(await util.apply('6X7', { alphabet: 'inverted' })).toBe('hi')
    expect(await util.apply('7vUrSKB', { alphabet: 'inverted' })).toBe('café')
    expect(await util.apply('1WjFRZVDBTxuoLuJuF', { alphabet: 'inverted' })).toBe('Hello, World!')
  })

  it('tolerates whitespace anywhere in the input', async () => {
    expect(await util.apply(' 1wJfr zvdbt\nXUOlUjUf\t', {})).toBe('Hello, World!')
  })

  it('decodes high bytes (0x80-0xFF) for both alphabets', async () => {
    const hi = hex('80ff00fe')
    expect(await util.apply('2MSk8M', { output: 'bytes' })).toEqual(hi)
    expect(await util.apply('2msK8m', { alphabet: 'inverted', output: 'bytes' })).toEqual(hi)
    expect(await util.apply('2uqFxlEY22QFH6f81G84eOYhM8', {})).toBe('The quick brown fox')
  })

  it('restores leading zero bytes and returns raw bytes when asked', async () => {
    expect(await util.apply('0047', { output: 'bytes' })).toEqual(new Uint8Array([0, 0, 255]))
    expect(await util.apply('H31', { output: 'bytes' })).toEqual(new Uint8Array([255, 255]))
    expect(await util.apply('000', { output: 'bytes' })).toEqual(new Uint8Array([0, 0, 0]))
  })

  it('throws on invalid characters and unknown alphabets', () => {
    expect(() => util.apply('6x7-', {})).toThrow(/invalid base62 character: "-"/)
    expect(() => util.apply('6x7=', {})).toThrow(/invalid base62 character: "="/)
    expect(() => util.apply('café', {})).toThrow(/invalid base62 character: "é"/)
    expect(() => util.apply('6x7', { alphabet: 'rot62' })).toThrow(/unknown base62 alphabet/)
  })

  it('throws when the decoded bytes are not valid UTF-8 text', async () => {
    const encoded = await encoder.apply(new Uint8Array([0xff, 0xfe]), {})
    expect(() => util.apply(encoded, {})).toThrow(/not valid UTF-8/)
  })

  it('round-trips text encoded by base62_encode, including Unicode', async () => {
    for (const sample of ['Hello, World!', 'naïve café', '日本語 🚀', 'a']) {
      const encoded = await encoder.apply(sample, {})
      expect(await util.apply(encoded, {})).toBe(sample)
    }
  })
})
