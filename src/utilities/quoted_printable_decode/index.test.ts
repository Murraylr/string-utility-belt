import { describe, it, expect } from 'vitest'
import util from './index'
import encoder from '../quoted_printable_encode/index'

const bytes = (v: unknown) => Array.from(v as Uint8Array)

describe('quoted_printable_decode', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('quoted_printable_decode')
    expect(util.name).toBe('quoted-printable decode')
    expect(util.category).toBe('Decoding')
    expect(util.accepts).toBe('string')
    expect(util.produces).toEqual(['string', 'bytes'])
    expect(Object.keys(util.params)).toEqual(['output'])
    expect(util.params.output).toMatchObject({
      kind: 'select',
      default: 'text',
      options: ['text', 'bytes']
    })
  })

  it('decodes =XX groups back to utf-8 text', async () => {
    expect(await util.apply('caf=C3=A9', {})).toBe('café')
    expect(await util.apply('caf=c3=a9', {})).toBe('café')
    expect(await util.apply('=F0=9F=98=80', {})).toBe('😀')
    expect(await util.apply('=E6=97=A5=E6=9C=AC=E8=AA=9E', {})).toBe('日本語')
    expect(await util.apply('a=3Db', {})).toBe('a=b')
    expect(await util.apply('caf=C3=A9', { output: 'text' })).toBe('café')
  })

  it('decodes the RFC 2045 section 6.7 worked example', async () => {
    // The RFC's own illustration: a soft break may follow data whitespace, and
    // that whitespace is data, not transport padding.
    const encoded = "Now's the time =\r\nfor all folk to come=\r\n to the aid of their country."
    expect(await util.apply(encoded, {})).toBe(
      "Now's the time for all folk to come to the aid of their country."
    )
  })

  it('removes soft line breaks and keeps hard ones', async () => {
    expect(await util.apply('abc=\r\ndef', {})).toBe('abcdef')
    expect(await util.apply('abc=\ndef', {})).toBe('abcdef')
    expect(await util.apply('abc=', {})).toBe('abc')
    expect(await util.apply('a\r\nb', {})).toBe('a\r\nb')
    expect(await util.apply('a\nb', {})).toBe('a\nb')
    expect(await util.apply('a\rb', {})).toBe('a\rb')
    expect(await util.apply('a\n\nb', {})).toBe('a\n\nb')
  })

  it('drops transport-added trailing whitespace and restores escaped whitespace', async () => {
    expect(await util.apply('a  \r\nb', {})).toBe('a\r\nb')
    expect(await util.apply('a\t\t\nb', {})).toBe('a\nb')
    expect(await util.apply('a=20\r\nb', {})).toBe('a \r\nb')
    expect(await util.apply('end=09', {})).toBe('end\t')
    // leading whitespace is data and must survive
    expect(await util.apply('  indented', {})).toBe('  indented')
  })

  it('returns raw bytes when output is bytes', async () => {
    expect(bytes(await util.apply('=00=FF=41', { output: 'bytes' }))).toEqual([0, 255, 65])
    expect(bytes(await util.apply('=C3=A9', { output: 'bytes' }))).toEqual([0xc3, 0xa9])
    // high bytes that are not valid utf-8 are fine in bytes mode
    expect(bytes(await util.apply('=80=FE=FF', { output: 'bytes' }))).toEqual([0x80, 0xfe, 0xff])
    expect(bytes(await util.apply('', { output: 'bytes' }))).toEqual([])
    expect(await util.apply('', { output: 'bytes' })).toBeInstanceOf(Uint8Array)
  })

  it('handles empty input and plain text without escapes', async () => {
    expect(await util.apply('', {})).toBe('')
    expect(await util.apply('plain text', {})).toBe('plain text')
    expect(await util.apply('日本語', {})).toBe('日本語')
    // an astral character pasted in literally is not split into surrogate halves
    expect(await util.apply('a😀b', {})).toBe('a😀b')
  })

  it('throws on malformed escapes and undecodable output', () => {
    expect(() => util.apply('=ZZ', {})).toThrow(/invalid quoted-printable escape/)
    expect(() => util.apply('a=4', {})).toThrow(/invalid quoted-printable escape/)
    expect(() => util.apply('a=', { output: 'bytes' })).not.toThrow()
    expect(() => util.apply('=FF', { output: 'text' })).toThrow(/not valid UTF-8/)
    expect(() => util.apply('abc', { output: 'binary' })).toThrow(/unknown output/)
  })

  it('round-trips text and bytes produced by quoted_printable_encode', async () => {
    const text = 'Grüße 😀 — a line with = signs\r\nand trailing space \nplus ' + 'q'.repeat(90)
    expect(await util.apply(await encoder.apply(text, {}), {})).toBe(text)
    expect(await util.apply(await encoder.apply(text, { lineLength: 8 }), {})).toBe(text)

    const raw = new Uint8Array([0, 9, 10, 13, 32, 61, 61, 128, 254, 255])
    expect(bytes(await util.apply(await encoder.apply(raw, {}), { output: 'bytes' }))).toEqual(
      Array.from(raw)
    )
  })
})

describe('quoted_printable_decode — attacker-sized input', () => {
  // stripping transport padding with /[ \t]+$/ was quadratic on a long inner space run
  it('decodes a line holding a huge inner run of spaces in linear time', () => {
    const t0 = performance.now()
    const out = util.apply(' '.repeat(200_000) + 'x \t', {}) as string
    expect(performance.now() - t0).toBeLessThan(1500)
    expect(out).toBe(' '.repeat(200_000) + 'x')
  })
})
