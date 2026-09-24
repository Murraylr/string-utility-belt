import { describe, it, expect } from 'vitest'
import util from './index'
import encoder from '../codepoints_encode/index'

describe('codepoints_decode', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('codepoints_decode')
    expect(util.name).toBe('from code points')
    expect(util.category).toBe('Decoding')
    expect(util.accepts).toBe('string')
    expect(util.produces).toBe('string')
    expect(Object.keys(util.params)).toEqual(['format'])
  })

  it('decodes U+XXXX notation', async () => {
    expect(await util.apply('U+0048 U+0069', {})).toBe('Hi')
    expect(await util.apply('u+1f600', {})).toBe('😀')
  })

  it('returns empty string for empty input', async () => {
    expect(await util.apply('', {})).toBe('')
    expect(await util.apply('  ,  ', {})).toBe('')
  })

  it('auto-detects the radix of bare tokens and mixed notations', async () => {
    expect(await util.apply('128512', {})).toBe('😀')
    expect(await util.apply('1F600', {})).toBe('😀')
    expect(await util.apply('0x1F600', {})).toBe('😀')
    expect(await util.apply('U+0048 0x69 33', {})).toBe('Hi!')
  })

  it('decodes brace escapes and surrogate-pair escapes', async () => {
    expect(await util.apply('\\u{1F600}', {})).toBe('😀')
    expect(await util.apply('\\u{48}\\u{69}', {})).toBe('Hi')
    expect(await util.apply('\\uD83D\\uDE00', {})).toBe('😀')
    expect(await util.apply('\\u00E9', {})).toBe('é')
  })

  it('ignores any separator the encoder can emit, not just a punctuation whitelist', async () => {
    expect(await util.apply('U+0048-U+0069', {})).toBe('Hi')
    expect(await util.apply('U+0048 => U+0069', {})).toBe('Hi')
    expect(await util.apply('U+0048 · U+0069', {})).toBe('Hi')
    expect(await util.apply('U+0048 — U+0069', {})).toBe('Hi')
    expect(await util.apply('U+0048+U+0069', {})).toBe('Hi')
  })

  it('forces the radix of bare tokens when format is hex or decimal', async () => {
    expect(await util.apply('0048 0069', { format: 'hex' })).toBe('Hi')
    // the same tokens read as decimal are code points 48 and 69
    expect(await util.apply('0048 0069', { format: 'decimal' })).toBe('0E')
    expect(await util.apply('72 105', { format: 'decimal' })).toBe('Hi')
  })

  it('throws on junk tokens, out-of-range values and bad radix', () => {
    expect(() => util.apply('hello there', {})).toThrow(/invalid code point token/)
    expect(() => util.apply('0x110000', {})).toThrow(/out of range/)
    expect(() => util.apply('1F600', { format: 'decimal' })).toThrow(/not a decimal code point/)
  })

  it('round-trips every codepoints_encode format, including unicode', async () => {
    const text = 'Grüße 😀 — ok'
    expect(await util.apply(await encoder.apply(text, {}) as string, {})).toBe(text)
    expect(await util.apply(await encoder.apply(text, { format: 'escaped' }) as string, {})).toBe(text)
    expect(await util.apply(await encoder.apply(text, { format: 'decimal' }) as string, { format: 'decimal' })).toBe(text)
    expect(await util.apply(await encoder.apply(text, { format: 'hex' }) as string, { format: 'hex' })).toBe(text)
    expect(await util.apply(await encoder.apply(text, { separator: '' }) as string, {})).toBe(text)
  })

  it('round-trips every separator the encoder offers', async () => {
    const text = 'Grüße 😀 — ok'
    for (const separator of [' ', '-', ', ', ' | ', ' => ', ' · ', ' — ', '_', '+', '\\n']) {
      for (const format of ['u-plus', 'escaped']) {
        const encoded = await encoder.apply(text, { format, separator }) as string
        expect({ format, separator, out: await util.apply(encoded, {}) })
          .toEqual({ format, separator, out: text })
      }
    }
  })
})
