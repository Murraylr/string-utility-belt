import { describe, it, expect } from 'vitest'
import util from './index'
import decoder from '../unicode_escape_decode/index'

const STYLES = ['js-u', 'js-braces', 'css', 'python', 'java', 'html-hex', 'html-dec']
const SCOPES = ['non-ascii', 'all']

describe('unicode_escape_encode', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('unicode_escape_encode')
    expect(util.name).toBe('unicode escape')
    expect(util.category).toBe('Encoding')
    expect(util.accepts).toBe('string')
    expect(util.produces).toBe('string')
    expect(Object.keys(util.params).sort()).toEqual(['scope', 'style'])
  })

  it('declares the documented options and defaults', () => {
    expect(util.params.style).toMatchObject({ kind: 'select', default: 'js-u', options: STYLES })
    expect(util.params.scope).toMatchObject({ kind: 'select', default: 'non-ascii', options: SCOPES })
  })

  it('escapes non-ascii only by default', async () => {
    expect(await util.apply('café', {})).toBe('caf\\u00e9')
    expect(await util.apply('The quick brown fox.', {})).toBe('The quick brown fox.')
    // U+00E9 = 233, U+20AC = 8364 -> \u20ac
    expect(await util.apply('20 € for a café', {})).toBe('20 \\u20ac for a caf\\u00e9')
  })

  it('escapes astral characters as surrogate pairs in js-u and java styles', async () => {
    // U+1F600 - 0x10000 = 0xF600 -> hi D800+0x3D = D83D, lo DC00+0x200 = DE00
    expect(await util.apply('😀', { style: 'js-u' })).toBe('\\ud83d\\ude00')
    expect(await util.apply('😀', { style: 'java' })).toBe('\\ud83d\\ude00')
    expect(await util.apply('é', { style: 'java' })).toBe('\\u00e9')
    // the emoji must never be split into two separate escaped code points
    expect(await util.apply('😀', { style: 'js-u' })).not.toContain('\\ud83d\\ud83d')
  })

  it('escapes astral characters as a single unit in js-braces and python styles', async () => {
    expect(await util.apply('a😀', { style: 'js-braces' })).toBe('a\\u{1f600}')
    expect(await util.apply('é😀', { style: 'python' })).toBe('\\u00e9\\U0001f600')
    // the widest legal code point still fits python's 8 hex digits
    expect(await util.apply('\u{10ffff}', { style: 'python' })).toBe('\\U0010ffff')
    expect(await util.apply('\u{10ffff}', { style: 'js-braces' })).toBe('\\u{10ffff}')
  })

  it('supports css and html styles including astral code points', async () => {
    expect(await util.apply('é', { style: 'css' })).toBe('\\e9 ')
    // the delimiting space keeps the escape unambiguous before a hex digit
    expect(await util.apply('é9', { style: 'css' })).toBe('\\e9 9')
    expect(await util.apply('😀', { style: 'css' })).toBe('\\1f600 ')
    expect(await util.apply('é', { style: 'html-hex' })).toBe('&#xe9;')
    expect(await util.apply('😀', { style: 'html-hex' })).toBe('&#x1f600;')
    expect(await util.apply('é', { style: 'html-dec' })).toBe('&#233;')
    // 0x1F600 === 128512
    expect(await util.apply('😀', { style: 'html-dec' })).toBe('&#128512;')
  })

  it('escapes every character when scope is all', async () => {
    expect(await util.apply('Hi', { style: 'js-u', scope: 'all' })).toBe('\\u0048\\u0069')
    expect(await util.apply('ab', { style: 'html-dec', scope: 'all' })).toBe('&#97;&#98;')
    expect(await util.apply('ab', { style: 'css', scope: 'all' })).toBe('\\61 \\62 ')
    expect(await util.apply('a', { style: 'js-braces', scope: 'all' })).toBe('\\u{61}')
    expect(await util.apply('a', { style: 'python', scope: 'all' })).toBe('\\u0061')
    expect(await util.apply('a', { style: 'html-hex', scope: 'all' })).toBe('&#x61;')
    // whitespace and control characters are escaped too, not passed through
    expect(await util.apply('\n\t', { style: 'js-u', scope: 'all' })).toBe('\\u000a\\u0009')
    expect(await util.apply('\n', { style: 'css', scope: 'all' })).toBe('\\a ')
  })

  it('always escapes the escape delimiters \\ and & even in non-ascii scope', async () => {
    // Otherwise a source that already looks like an escape decodes to something
    // else entirely: "a\\e9 b" would come back as "aéb".
    expect(await util.apply('C:\\temp', { style: 'js-u' })).toBe('C:\\u005ctemp')
    expect(await util.apply('C:\\temp', { style: 'java' })).toBe('C:\\u005ctemp')
    expect(await util.apply('a\\b', { style: 'js-braces' })).toBe('a\\u{5c}b')
    expect(await util.apply('a\\b', { style: 'python' })).toBe('a\\u005cb')
    expect(await util.apply('a\\b', { style: 'css' })).toBe('a\\5c b')
    expect(await util.apply('a\\b', { style: 'html-dec' })).toBe('a&#92;b')
    expect(await util.apply('AT&T', { style: 'html-dec' })).toBe('AT&#38;T')
    expect(await util.apply('AT&T', { style: 'html-hex' })).toBe('AT&#x26;T')
    expect(await util.apply('AT&T', { style: 'js-u' })).toBe('AT\\u0026T')
    expect(await util.apply('AT&T', { style: 'css' })).toBe('AT\\26 T')
    // every other ascii character is still left alone
    expect(await util.apply('<a href="#">%$</a>', { style: 'js-u' })).toBe('<a href="#">%$</a>')
  })

  it('handles empty input', async () => {
    expect(await util.apply('', {})).toBe('')
    expect(await util.apply('', { style: 'html-dec', scope: 'all' })).toBe('')
    expect(await util.apply('', { style: 'css', scope: 'all' })).toBe('')
  })

  it('rejects unknown options', () => {
    expect(() => util.apply('x', { style: 'perl' })).toThrow(/unknown style/)
    expect(() => util.apply('x', { scope: 'some' })).toThrow(/unknown scope/)
  })

  it('round-trips every style and scope through unicode_escape_decode', async () => {
    const sources = [
      'Grüße — naïve 😀 日本語 <tag>',
      'C:\\temp\\new & "AT&T" 100% <b>',
      'regex \\d+ \\w* \\u0041 &#233; &amp;',
      'a\\e9 b',
      '\u0000\u0001\t\n\r\u007f',
      'ñ\u00ad\u200b𝔘💩'
    ]
    for (const source of sources) {
      for (const style of STYLES) {
        for (const scope of SCOPES) {
          const encoded = await util.apply(source, { style, scope })
          expect({ style, scope, source, out: await decoder.apply(encoded, {}) }).toEqual({
            style,
            scope,
            source,
            out: source
          })
        }
      }
    }
  })
})
