import { describe, it, expect } from 'vitest'
import util from './index'

describe('tr', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('tr')
    expect(util.name).toBe('translate characters')
    expect(util.category).toBe('String Ops')
    expect(util.accepts).toBe('string')
    expect(util.produces).toBe('string')
    expect(Object.keys(util.params).sort()).toEqual(['delete', 'from', 'ranges', 'squeeze', 'to'])
  })

  it('translates a range of characters', async () => {
    expect(await util.apply('hello world', { from: 'a-z', to: 'A-Z' })).toBe('HELLO WORLD')
    expect(await util.apply('a1b2', { from: '0-9', to: '#' })).toBe('a#b#')
  })

  it('returns empty string for empty input', async () => {
    expect(await util.apply('', { from: 'a-z', to: 'A-Z' })).toBe('')
    expect(await util.apply('', {})).toBe('')
  })

  it('is a no-op when no sets are given', async () => {
    expect(await util.apply('abc', {})).toBe('abc')
    expect(await util.apply('abc', { from: 'abc', to: '' })).toBe('abc')
  })

  it('pads a short "to" set with its last character and lets later duplicates win', async () => {
    expect(await util.apply('abcd', { from: 'abcd', to: 'xy' })).toBe('xyyy')
    expect(await util.apply('aaa', { from: 'aa', to: 'xy' })).toBe('yyy')
  })

  it('ignores a "to" set longer than the "from" set', async () => {
    expect(await util.apply('abc', { from: 'abc', to: 'xyzw' })).toBe('xyz')
  })

  it('deletes characters when delete is on', async () => {
    expect(await util.apply('hello world', { from: 'aeiou', delete: true })).toBe('hll wrld')
    expect(await util.apply('a1b2c3', { from: '[:digit:]', delete: true })).toBe('abc')
  })

  it('squeezes repeats', async () => {
    expect(await util.apply('a   b  c', { from: ' ', squeeze: true })).toBe('a b c')
    expect(await util.apply('aabbcc', { from: 'ab', to: 'xx', squeeze: true })).toBe('xcc')
    expect(await util.apply('aa--bb', { from: '-', to: 'b', delete: true, squeeze: true })).toBe('aab')
    // With both sets the squeeze applies to the translated "to" set, per POSIX.
    expect(await util.apply('aabb', { from: 'ab', to: 'xy', squeeze: true })).toBe('xy')
    expect(await util.apply('aabbaa', { from: 'a', to: 'b', squeeze: true })).toBe('b')
    expect(await util.apply('a   b\t\tc', { from: '[:space:]', to: ' ', squeeze: true })).toBe('a b c')
  })

  it('expands POSIX character classes', async () => {
    expect(await util.apply('Hello World!', { from: '[:upper:]', to: '[:lower:]' })).toBe('hello world!')
    expect(await util.apply('a b\tc', { from: '[:space:]', to: '_' })).toBe('a_b_c')
    expect(await util.apply('a1!', { from: '[:alnum:]', delete: true })).toBe('!')
    expect(await util.apply('a1!', { from: '[:punct:]', to: '.' })).toBe('a1.')
  })

  it('translates a rot13 pair of ranges', async () => {
    expect(await util.apply('Hello, World', { from: 'A-Za-z', to: 'N-ZA-Mn-za-m' })).toBe('Uryyb, Jbeyq')
  })

  it('treats "-" literally when ranges are disabled', async () => {
    expect(await util.apply('cab-', { from: 'a-c', to: 'x', ranges: false })).toBe('xxbx')
    expect(await util.apply('cab-', { from: 'a-c', to: 'x' })).toBe('xxx-')
  })

  it('handles astral characters as whole code points', async () => {
    expect(await util.apply('\u{1F600} hi \u{1F642}', { from: '\u{1F600}\u{1F642}', to: '\u{1F642}\u{1F600}' }))
      .toBe('\u{1F642} hi \u{1F600}')
    expect(await util.apply('aaa\u{1F600}\u{1F600}', { from: '\u{1F600}', squeeze: true })).toBe('aaa\u{1F600}')
    expect(await util.apply('naïve café', { from: 'ïé', to: 'ie' })).toBe('naive cafe')
  })

  it('resolves backslash escapes in the sets', async () => {
    expect(await util.apply('a\tb', { from: '\\t', to: '_' })).toBe('a_b')
    expect(await util.apply('a\nb', { from: '\\012', to: ' ' })).toBe('a b')
    expect(await util.apply('a-b', { from: '\\-', to: '+' })).toBe('a+b')
    expect(await util.apply('a©b', { from: '\\u00A9', to: '@' })).toBe('a@b')
    expect(await util.apply('ABC', { from: '\\x41-\\x43', to: 'xyz' })).toBe('xyz')
    expect(await util.apply('a\\b', { from: '\\\\', to: '/' })).toBe('a/b')
  })

  it('throws on an inverted range', () => {
    expect(() => util.apply('anything', { from: 'z-a', to: 'A' })).toThrow(/invalid range/)
  })

  it('throws on an unknown character class', () => {
    expect(() => util.apply('anything', { from: '[:nope:]', to: 'x' })).toThrow(/unknown character class/)
  })

  it('throws on a malformed hex escape', () => {
    expect(() => util.apply('anything', { from: '\\uZZ', to: 'x' })).toThrow(/invalid \\u escape/)
  })
})
