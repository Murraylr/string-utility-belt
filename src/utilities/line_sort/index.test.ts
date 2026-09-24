import { describe, it, expect } from 'vitest'
import util from './index'

describe('line_sort', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('line_sort')
    expect(util.category).toBe('Formatting')
    expect(util.params.direction.default).toBe('asc')
    expect(util.params.caseSensitive.default).toBe(false)
  })

  it('sorts lines ascending (case-insensitive)', () => {
    expect(util.apply('banana\napple\ncherry', { direction: 'asc', caseSensitive: false }))
      .toBe('apple\nbanana\ncherry')
  })

  it('sorts lines descending', () => {
    expect(util.apply('apple\nbanana\ncherry', { direction: 'desc', caseSensitive: false }))
      .toBe('cherry\nbanana\napple')
  })

  it('sorts case-insensitive by default', () => {
    expect(util.apply('Banana\napple\nCherry', { direction: 'asc', caseSensitive: false }))
      .toBe('apple\nBanana\nCherry')
  })

  it('sorts case-sensitive', () => {
    const out = util.apply('banana\nApple\ncherry', { direction: 'asc', caseSensitive: true })
    // Uppercase A < lowercase b in ASCII
    expect(out).toBe('Apple\nbanana\ncherry')
  })

  it('handles single line', () => {
    expect(util.apply('hello', { direction: 'asc', caseSensitive: false })).toBe('hello')
  })

  it('handles empty string', () => {
    expect(util.apply('', { direction: 'asc', caseSensitive: false })).toBe('')
  })

  it('handles duplicate lines', () => {
    expect(util.apply('b\na\nb\na', { direction: 'asc', caseSensitive: false }))
      .toBe('a\na\nb\nb')
  })

  it('preserves a trailing newline instead of sorting it to the top', () => {
    expect(util.apply('b\na\n', { direction: 'asc', caseSensitive: false }))
      .toBe('a\nb\n')
  })

  it('sorts CRLF text without gluing CR into comparisons', () => {
    expect(util.apply('b\r\na', { direction: 'asc', caseSensitive: true }))
      .toBe('a\r\nb')
    expect(util.apply('b\r\na\r\n', { direction: 'asc', caseSensitive: true }))
      .toBe('a\r\nb\r\n')
  })

  it('exposes the extended mode options', () => {
    expect(util.params.mode).toMatchObject({
      options: ['alphabetical', 'numeric', 'natural', 'length', 'column', 'random']
    })
    expect(util.params.mode.default).toBe('alphabetical')
    expect(util.params.unique.default).toBe(false)
    expect(util.params.column.default).toBe(1)
    expect(util.params.seed.default).toBe(0)
  })

  it('sorts numerically instead of lexically', () => {
    expect(util.apply('10\n9\n100\n2', { mode: 'numeric' })).toBe('2\n9\n10\n100')
  })

  it('sorts numerically with negatives and decimals', () => {
    expect(util.apply('-3\n2.5\n-10\n0', { mode: 'numeric' })).toBe('-10\n-3\n0\n2.5')
  })

  it('pushes non-numeric lines to the end in numeric mode', () => {
    expect(util.apply('banana\n3\napple\n1', { mode: 'numeric' })).toBe('1\n3\napple\nbanana')
  })

  it('sorts naturally so v2 precedes v10', () => {
    expect(util.apply('v10\nv2\nv1', { mode: 'natural' })).toBe('v1\nv2\nv10')
  })

  it('sorts naturally across mixed text and numbers', () => {
    expect(util.apply('img12.png\nimg10.png\nimg2.png', { mode: 'natural' }))
      .toBe('img2.png\nimg10.png\nimg12.png')
  })

  it('sorts by length, counting code points not UTF-16 units', () => {
    expect(util.apply('ccc\na\nbb', { mode: 'length' })).toBe('a\nbb\nccc')
    // one emoji is a single character, so it must sort before a two-letter line
    expect(util.apply('ab\n😀', { mode: 'length' })).toBe('😀\nab')
  })

  it('sorts by a whitespace-delimited column', () => {
    expect(util.apply('alice 30\nbob 25\ncarol 40', { mode: 'column', column: 2 }))
      .toBe('bob 25\nalice 30\ncarol 40')
  })

  it('sorts by a column with an explicit separator', () => {
    expect(util.apply('alice,30\nbob,25\ncarol,40', { mode: 'column', column: 2, separator: ',' }))
      .toBe('bob,25\nalice,30\ncarol,40')
  })

  it('removes duplicates when unique is set', () => {
    expect(util.apply('b\na\nb\na', { unique: true })).toBe('a\nb')
  })

  it('treats duplicates case-insensitively unless case sensitive', () => {
    expect(util.apply('Apple\napple', { unique: true })).toBe('Apple')
    expect(util.apply('Apple\napple', { unique: true, caseSensitive: true })).toBe('Apple\napple')
  })

  it('shuffles deterministically for a given seed', () => {
    const input = 'a\nb\nc\nd\ne\nf\ng\nh'
    const first = util.apply(input, { mode: 'random', seed: 42 }) as string
    const second = util.apply(input, { mode: 'random', seed: 42 }) as string
    expect(first).toBe(second)
    expect(first.split('\n').sort().join('\n')).toBe('a\nb\nc\nd\ne\nf\ng\nh')
    expect(util.apply(input, { mode: 'random', seed: 7 })).not.toBe(first)
  })

  it('reverses the extended modes when direction is desc', () => {
    expect(util.apply('10\n9\n100', { mode: 'numeric', direction: 'desc' })).toBe('100\n10\n9')
  })
})
