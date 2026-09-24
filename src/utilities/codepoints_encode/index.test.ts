import { describe, it, expect } from 'vitest'
import util from './index'

describe('codepoints_encode', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('codepoints_encode')
    expect(util.name).toBe('to code points')
    expect(util.category).toBe('Encoding')
    expect(util.accepts).toBe('string')
    expect(util.produces).toBe('string')
    expect(Object.keys(util.params).sort()).toEqual(['format', 'separator'])
  })

  it('lists code points as U+XXXX by default', async () => {
    expect(await util.apply('Hi', {})).toBe('U+0048 U+0069')
  })

  it('returns empty string for empty input', async () => {
    expect(await util.apply('', {})).toBe('')
  })

  it('emits one entry per code point, not per utf-16 unit', async () => {
    // '😀' is a surrogate pair in JS but a single code point
    expect(await util.apply('😀', {})).toBe('U+1F600')
    expect(await util.apply('aé😀', {})).toBe('U+0061 U+00E9 U+1F600')
  })

  it('supports every format option', async () => {
    expect(await util.apply('A😀', { format: 'u-plus' })).toBe('U+0041 U+1F600')
    expect(await util.apply('A😀', { format: 'hex' })).toBe('0041 1F600')
    expect(await util.apply('A😀', { format: 'decimal' })).toBe('65 128512')
    expect(await util.apply('A😀', { format: 'escaped' })).toBe('\\u{0041} \\u{1F600}')
  })

  it('honours the separator param', async () => {
    expect(await util.apply('Hi', { separator: ', ' })).toBe('U+0048, U+0069')
    expect(await util.apply('Hi', { separator: '' })).toBe('U+0048U+0069')
    expect(await util.apply('Hi', { separator: '\\n' })).toBe('U+0048\nU+0069')
    expect(await util.apply('Hi', { separator: '\\t' })).toBe('U+0048\tU+0069')
    expect(await util.apply('Hi', { separator: ' — ' })).toBe('U+0048 — U+0069')
  })

  it('falls back to u-plus for an unknown format', async () => {
    expect(await util.apply('A', { format: 'nonsense' })).toBe('U+0041')
  })
})
