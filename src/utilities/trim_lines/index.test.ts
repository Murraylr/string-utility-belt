import { describe, it, expect } from 'vitest'
import util from './index'

// Built from code points on purpose: as raw characters these are invisible (or,
// for the emoji, easy to mangle) in the source, and a stray editor or format pass
// could silently turn them into plain spaces — quietly making the assertions
// below trivially true.
const APPLE = String.fromCodePoint(0x1f34e) // astral (non-BMP) character
const NBSP = String.fromCodePoint(0x00a0)
const IDEOGRAPHIC_SPACE = String.fromCodePoint(0x3000)
const ZWSP = String.fromCodePoint(0x200b)

describe('trim_lines', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('trim_lines')
    expect(util.name).toBe('trim each line')
    expect(util.category).toBe('Lines')
    expect(util.accepts).toBe('string')
    expect(util.produces).toBe('string')
  })

  it('trims whitespace from both sides by default', async () => {
    expect(await util.apply('  hello  \n\tworld\t', {})).toBe('hello\nworld')
    expect(await util.apply('  keep   inner  spaces  ', {})).toBe('keep   inner  spaces')
  })

  it('trims only the requested side', async () => {
    expect(await util.apply('  hi  \n  there  ', { side: 'start' })).toBe('hi  \nthere  ')
    expect(await util.apply('  hi  \n  there  ', { side: 'end' })).toBe('  hi\n  there')
    expect(await util.apply('  hi  ', { side: 'both' })).toBe('hi')
  })

  it('trims a custom character set instead of whitespace', async () => {
    expect(await util.apply('--a--\n--b', { characters: '-' })).toBe('a\nb')
    expect(await util.apply('##title##', { characters: '#', side: 'start' })).toBe('title##')
    // whitespace is no longer trimmed once a custom set is given
    expect(await util.apply('  x  ', { characters: '-' })).toBe('  x  ')
  })

  it('accepts typed escapes in the custom character set', async () => {
    expect(await util.apply('\ta\t', { characters: '\\t' })).toBe('a')
    expect(await util.apply('...tail', { characters: '.' })).toBe('tail')
  })

  it('handles empty input and blank lines without throwing', async () => {
    expect(await util.apply('', {})).toBe('')
    expect(await util.apply('   ', {})).toBe('')
    expect(await util.apply('a\n\nb', {})).toBe('a\n\nb')
  })

  it('handles astral characters and unicode whitespace', async () => {
    // the trimmed set holds an astral character: it must match whole, never by surrogate half
    expect(await util.apply(`${APPLE}x${APPLE}`, { characters: APPLE })).toBe('x')
    expect(await util.apply(`${APPLE}${APPLE} keep ${APPLE}`, { characters: `${APPLE} ` })).toBe(
      'keep'
    )
    const accented = `caf${String.fromCodePoint(0xe9)}`
    expect(await util.apply(`  ${APPLE} ${accented} ${APPLE}  `, {})).toBe(
      `${APPLE} ${accented} ${APPLE}`
    )
    // NBSP and the ideographic space count as whitespace
    expect(await util.apply(`${NBSP}${accented}${IDEOGRAPHIC_SPACE}`, {})).toBe(accented)
    // ...but a zero-width space is NOT whitespace, so it must survive an ordinary trim
    expect(await util.apply(` ${ZWSP}hi${ZWSP} `, {})).toBe(`${ZWSP}hi${ZWSP}`)
    // it can still be removed explicitly through the custom set
    expect(await util.apply(`${ZWSP}hi${ZWSP}`, { characters: ZWSP })).toBe('hi')
  })

  it('preserves the document line endings', async () => {
    expect(await util.apply(' a \n', {})).toBe('a\n')
    expect(await util.apply(' a \r\n b \r\n', {})).toBe('a\r\nb\r\n')
  })

  it('rejects an unknown side', () => {
    expect(() => util.apply('  a  ', { side: 'middle' })).toThrow(/unknown side/)
  })
})
