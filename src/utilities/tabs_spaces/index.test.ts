import { describe, it, expect } from 'vitest'
import util from './index'

describe('tabs_spaces', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('tabs_spaces')
    expect(util.name).toBe('tabs ↔ spaces')
    expect(util.category).toBe('Formatting')
    expect(util.accepts).toBe('string')
    expect(util.produces).toBe('string')
    expect(Object.keys(util.params).sort()).toEqual(['direction', 'leadingOnly', 'tabWidth'])
  })

  it('expands tabs to real tab stops, not a blind replace', async () => {
    expect(await util.apply('\tab', {})).toBe('    ab')
    expect(await util.apply('a\tb', {})).toBe('a   b')
    expect(await util.apply('abc\td', {})).toBe('abc d')
  })

  it('honours tabWidth', async () => {
    expect(await util.apply('\ta', { tabWidth: 8 })).toBe('        a')
    expect(await util.apply('a\tb', { tabWidth: 2 })).toBe('a b')
  })

  it('collapses spaces back onto tab stops', async () => {
    expect(await util.apply('    ab', { direction: 'spaces-to-tabs' })).toBe('\tab')
    expect(await util.apply('a   b', { direction: 'spaces-to-tabs' })).toBe('a\tb')
    // a lone space is word spacing, not indentation
    expect(await util.apply('a b', { direction: 'spaces-to-tabs' })).toBe('a b')
  })

  it('collapses only as far as the next stop and leaves the remainder as spaces', async () => {
    // 'cd' sits at column 5, which no tab can reach from column 2
    expect(await util.apply('ab   cd', { direction: 'spaces-to-tabs' })).toBe('ab\t cd')
    expect(await util.apply('ab\t cd', {})).toBe('ab   cd')
    // a run that stops short of the next stop is left alone entirely
    expect(await util.apply('abc  d', { direction: 'spaces-to-tabs', tabWidth: 8 })).toBe('abc  d')
  })

  it('honours leadingOnly in both directions and both states', async () => {
    expect(await util.apply('\ta\tb', { leadingOnly: true })).toBe('    a\tb')
    expect(await util.apply('\ta\tb', { leadingOnly: false })).toBe('    a   b')
    expect(await util.apply('    a    b', { direction: 'spaces-to-tabs', leadingOnly: true }))
      .toBe('\ta    b')
    expect(await util.apply('    a    b', { direction: 'spaces-to-tabs', leadingOnly: false }))
      .toBe('\ta\t b')
  })

  it('round-trips indentation between the two directions', async () => {
    const spaces = await util.apply('\tif (x) {\n\t\ty()\n\t}', { direction: 'tabs-to-spaces' })
    expect(spaces).toBe('    if (x) {\n        y()\n    }')
    expect(await util.apply(spaces, { direction: 'spaces-to-tabs', leadingOnly: true }))
      .toBe('\tif (x) {\n\t\ty()\n\t}')
  })

  it('round-trips mid-line tabs, not just indentation', async () => {
    const spaces = String(await util.apply('a\tb\tc', { direction: 'tabs-to-spaces' }))
    expect(spaces).toBe('a   b   c')
    expect(await util.apply(spaces, { direction: 'spaces-to-tabs' })).toBe('a\tb\tc')
  })

  it('counts astral characters as one column and preserves line endings', async () => {
    expect(await util.apply('😀\tx', {})).toBe('😀   x')
    expect(await util.apply('a\tb\r\nc', {})).toBe('a   b\r\nc')
    expect(Array.from(String(await util.apply('😀\tx', {})))).toHaveLength(5)
    expect(await util.apply('😀   x', { direction: 'spaces-to-tabs' })).toBe('😀\tx')
  })

  it('returns empty string for empty input', async () => {
    expect(await util.apply('', {})).toBe('')
    expect(await util.apply('', { direction: 'spaces-to-tabs' })).toBe('')
  })

  it('throws on invalid params', () => {
    expect(() => util.apply('a', { tabWidth: 0 })).toThrow(/tab width/)
    expect(() => util.apply('a', { tabWidth: 2.5 })).toThrow(/whole number/)
    expect(() => util.apply('a', { direction: 'tabs-to-tabs' })).toThrow(/unknown direction/)
  })
})
