import { describe, it, expect } from 'vitest'
import util from './index'

const NBSP = String.fromCharCode(0xa0)
const IDEOGRAPHIC_SPACE = String.fromCharCode(0x3000)

describe('collapse_whitespace', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('collapse_whitespace')
    expect(util.name).toBe('collapse whitespace')
    expect(util.category).toBe('String Ops')
    expect(util.accepts).toBe('string')
    expect(util.produces).toBe('string')
    expect(Object.keys(util.params).sort())
      .toEqual(['newlines', 'spaces', 'tabsToSpaces', 'trim', 'unicodeSpaces'])
  })

  it('collapses space runs and trims by default', async () => {
    expect(await util.apply('   hello     world   ', {})).toBe('hello world')
  })

  it('collapses three or more newlines to one blank line', async () => {
    expect(await util.apply('a\n\n\n\nb', {})).toBe('a\n\nb')
    expect(await util.apply('a\n\nb', {})).toBe('a\n\nb')
    expect(await util.apply('a\r\n\r\n\r\n\r\nb', {})).toBe('a\r\n\r\nb')
  })

  it('leaves newline runs alone when newlines is false', async () => {
    expect(await util.apply('a\n\n\n\nb', { newlines: false })).toBe('a\n\n\n\nb')
  })

  it('leaves space runs alone when spaces is false', async () => {
    expect(await util.apply('a    b', { spaces: false })).toBe('a    b')
  })

  it('keeps outer whitespace when trim is false', async () => {
    expect(await util.apply('  a  b  ', { trim: false })).toBe(' a b ')
    expect(await util.apply('  a  \n  b  ', { trim: true })).toBe('a\nb')
  })

  it('converts tabs to spaces only when asked', async () => {
    expect(await util.apply('a\tb', { spaces: false, tabsToSpaces: true })).toBe('a b')
    expect(await util.apply('a\tb', { spaces: false, tabsToSpaces: false })).toBe('a\tb')
    expect(await util.apply('a\t\t\tb', { tabsToSpaces: true })).toBe('a b')
  })

  it('keeps tabs intact under the defaults, so tab-delimited data survives', async () => {
    expect(await util.apply('a\tb\tc', {})).toBe('a\tb\tc')
    // the empty middle field of a TSV row must not be swallowed
    expect(await util.apply('col1\t\tcol3', {})).toBe('col1\t\tcol3')
    expect(await util.apply('a \t  b', {})).toBe('a \t b')
    expect(await util.apply('a\tb\tc', { tabsToSpaces: true })).toBe('a b c')
  })

  it('normalizes unicode spaces such as NBSP when enabled', async () => {
    expect(await util.apply(`a${NBSP}${NBSP}b${IDEOGRAPHIC_SPACE}c`, {})).toBe('a b c')
    expect(await util.apply(`a${NBSP}${NBSP}b`, { unicodeSpaces: false })).toBe(`a${NBSP}${NBSP}b`)
  })

  it('preserves accented letters and astral emoji', async () => {
    const out = String(await util.apply('  héllo    🎉   wörld  ', {}))
    expect(out).toBe('héllo 🎉 wörld')
    expect(Array.from(out).includes('🎉')).toBe(true)
  })

  it('returns empty string for empty and whitespace-only input', async () => {
    expect(await util.apply('', {})).toBe('')
    expect(await util.apply('   \n\t  \n ', {})).toBe('')
  })

  it('is a no-op when every option is disabled', async () => {
    const messy = ' a\t\tb\n\n\n\nc '
    expect(await util.apply(messy, {
      spaces: false,
      newlines: false,
      trim: false,
      tabsToSpaces: false,
      unicodeSpaces: false
    })).toBe(messy)
  })

  it('throws on a non-boolean option value', () => {
    expect(() => util.apply('a  b', { spaces: 'maybe' } as any)).toThrow(/spaces must be true or false/)
    expect(() => util.apply('a  b', { trim: 42 } as any)).toThrow(/trim must be true or false/)
  })
})
