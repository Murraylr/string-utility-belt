import { describe, it, expect } from 'vitest'
import util from './index'
import encoder from '../unicode_escape_encode/index'

describe('unicode_escape_decode', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('unicode_escape_decode')
    expect(util.name).toBe('unicode unescape')
    expect(util.category).toBe('Decoding')
    expect(util.accepts).toBe('string')
    expect(util.produces).toBe('string')
    expect(util.params).toEqual({})
  })

  it('decodes js-style \\uXXXX escapes', async () => {
    expect(await util.apply('caf\\u00e9', {})).toBe('café')
    expect(await util.apply('\\u0048\\u0069', {})).toBe('Hi')
    expect(await util.apply('\\u4e2d\\u6587', {})).toBe('中文')
    // upper-case hex digits are accepted too
    expect(await util.apply('caf\\u00E9', {})).toBe('café')
  })

  it('rejoins surrogate pairs into astral characters', async () => {
    const emoji = await util.apply('\\ud83d\\ude00', {})
    expect(emoji).toBe('😀')
    // one code point, two UTF-16 units — not two broken halves
    expect(Array.from(emoji as string)).toHaveLength(1)
    expect((emoji as string).codePointAt(0)).toBe(0x1f600)
    expect(await util.apply('\\u{1f600}', {})).toBe('😀')
    expect(await util.apply('\\U0001f600', {})).toBe('😀')
    expect(await util.apply('a\\ud83d\\ude00b', {})).toBe('a😀b')
  })

  it('decodes byte, css and html escapes', async () => {
    expect(await util.apply('\\xe9', {})).toBe('é')
    expect(await util.apply('caf\\e9 ', {})).toBe('café')
    // css escapes of 1-6 hex digits, the delimiting space being consumed once
    expect(await util.apply('\\a ', {})).toBe('\n')
    expect(await util.apply('\\5c ', {})).toBe('\\')
    expect(await util.apply('\\1f600 ', {})).toBe('😀')
    expect(await util.apply('\\e9  x', {})).toBe('é x')
    expect(await util.apply('&#xe9;', {})).toBe('é')
    expect(await util.apply('&#X41;', {})).toBe('A')
    expect(await util.apply('&#233;', {})).toBe('é')
    expect(await util.apply('&#0233;', {})).toBe('é')
    expect(await util.apply('&#38;', {})).toBe('&')
    expect(await util.apply('&#x1f600;', {})).toBe('😀')
    expect(await util.apply('&#128512;', {})).toBe('😀')
  })

  it('decodes a mixture of styles in one pass', async () => {
    expect(await util.apply('\\u0048i &#233;\\u{21} \\U0001f600', {})).toBe('Hi é! 😀')
    expect(await util.apply('\\xe9-&#x2014;-\\2014 -\\u2014', {})).toBe('é-—-—-—')
  })

  it('leaves unknown escapes and plain text intact', async () => {
    expect(await util.apply('line\\nbreak \\d+ \\w \\q', {})).toBe('line\\nbreak \\d+ \\w \\q')
    expect(await util.apply('100% plain — 日本語', {})).toBe('100% plain — 日本語')
    // incomplete escapes are not silently mangled
    expect(await util.apply('\\u12 \\u{} &#; &#x;', {})).toBe('\\u12 \\u{} &#; &#x;')
    expect(await util.apply('AT&T &amp; Co', {})).toBe('AT&T &amp; Co')
  })

  it('handles empty input', async () => {
    expect(await util.apply('', {})).toBe('')
    expect(await util.apply(null as unknown as string, {})).toBe('')
  })

  it('throws on out-of-range code points', () => {
    expect(() => util.apply('\\u{110000}', {})).toThrow(/out of range/)
    expect(() => util.apply('&#x110000;', {})).toThrow(/out of range/)
    expect(() => util.apply('&#1114112;', {})).toThrow(/out of range/)
    expect(() => util.apply('\\U00110000', {})).toThrow(/out of range/)
    // the very last legal code point must still decode
    expect(util.apply('\\u{10ffff}', {})).toBe('\u{10ffff}')
  })

  it('round-trips text escaped by unicode_escape_encode', async () => {
    const source = 'Grüße — naïve 😀 日本語 & C:\\temp'
    for (const style of ['js-u', 'js-braces', 'css', 'python', 'java', 'html-hex', 'html-dec']) {
      for (const scope of ['non-ascii', 'all']) {
        const encoded = await encoder.apply(source, { style, scope })
        expect(encoded).not.toBe(source)
        expect({ style, scope, out: await util.apply(encoded, {}) }).toEqual({
          style,
          scope,
          out: source
        })
      }
    }
  })
})
