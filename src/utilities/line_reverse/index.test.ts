import { describe, it, expect } from 'vitest'
import util from './index'

describe('line_reverse', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('line_reverse')
    expect(util.name).toBe('reverse line order')
    expect(util.category).toBe('Lines')
    expect(util.accepts).toBe('string')
    expect(util.produces).toBe('string')
    expect(util.params).toEqual({})
  })

  it('reverses the order of the lines', async () => {
    expect(await util.apply('one\ntwo\nthree', {})).toBe('three\ntwo\none')
  })

  it('keeps a trailing newline at the end', async () => {
    expect(await util.apply('one\ntwo\nthree\n', {})).toBe('three\ntwo\none\n')
  })

  it('returns empty string for empty input', async () => {
    expect(await util.apply('', {})).toBe('')
  })

  it('leaves a single line untouched', async () => {
    expect(await util.apply('only', {})).toBe('only')
    expect(await util.apply('only\n', {})).toBe('only\n')
  })

  it('preserves blank lines as lines', async () => {
    expect(await util.apply('a\n\nb', {})).toBe('b\n\na')
  })

  it('preserves CRLF line endings', async () => {
    expect(await util.apply('a\r\nb\r\nc\r\n', {})).toBe('c\r\nb\r\na\r\n')
  })

  it('leaves each line ending alone in a file with mixed endings', async () => {
    // the separators stay put; only the line contents move, so a single CRLF cannot
    // convert the LF-terminated lines
    expect(await util.apply('a\r\nb\nc\nd\n', {})).toBe('d\r\nc\nb\na\n')
    expect(await util.apply('a\nb\r\nc', {})).toBe('c\nb\r\na')
    // and that keeps it a true involution even for a mixed file
    const mixed = 'one\r\ntwo\nthree\r\nfour'
    expect(await util.apply(await util.apply(mixed, {}), {})).toBe(mixed)
  })

  it('keeps non-ASCII and astral characters intact', async () => {
    expect(await util.apply('🎉 party\ncafé\n日本語\n', {})).toBe('日本語\ncafé\n🎉 party\n')
    // characters inside a line are never reordered
    expect(await util.apply('👨‍👩‍👧‍👦 family', {})).toBe('👨‍👩‍👧‍👦 family')
  })

  it('is its own inverse', async () => {
    const original = 'alpha\nbeta\ngamma\ndelta\n'
    const once = await util.apply(original, {})
    expect(await util.apply(once, {})).toBe(original)
  })

  it('ignores any params it is handed', async () => {
    expect(await util.apply('a\nb', { anything: true })).toBe('b\na')
  })
})
