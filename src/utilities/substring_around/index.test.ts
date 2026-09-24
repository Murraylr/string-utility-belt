import { describe, it, expect } from 'vitest'
import util from './index'

describe('substring_around', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('substring_around')
    expect(util.name).toBe('substring before / after')
    expect(util.category).toBe('String Ops')
    expect(util.accepts).toBe('string')
    expect(util.produces).toBe('string')
    expect(Object.keys(util.params)).toEqual([
      'delimiter', 'mode', 'endDelimiter', 'occurrence', 'perLine', 'ifMissing'
    ])
  })

  it('keeps the text before or after the delimiter', async () => {
    expect(await util.apply('user@example.com', { delimiter: '@' })).toBe('user')
    expect(await util.apply('user@example.com', { delimiter: '@', mode: 'after' })).toBe('example.com')
  })

  it('honours the last occurrence', async () => {
    expect(await util.apply('a.b.c', { delimiter: '.', mode: 'after', occurrence: 'last' })).toBe('c')
    expect(await util.apply('a.b.c', { delimiter: '.', mode: 'before', occurrence: 'last' })).toBe('a.b')
    expect(await util.apply('a.b.c', { delimiter: '.', mode: 'after', occurrence: 'first' })).toBe('b.c')
  })

  it('extracts between two different delimiters', async () => {
    expect(await util.apply('<b>bold</b>', { delimiter: '<b>', mode: 'between', endDelimiter: '</b>' }))
      .toBe('bold')
    expect(await util.apply('x [one] y [two] z', {
      delimiter: '[', mode: 'between', endDelimiter: ']', occurrence: 'last'
    })).toBe('two')
    expect(await util.apply('x [one] y [two] z', {
      delimiter: '[', mode: 'between', endDelimiter: ']', occurrence: 'first'
    })).toBe('one')
  })

  it('reuses the delimiter as the end marker when none is given', async () => {
    expect(await util.apply('say "hi" now', { delimiter: '"', mode: 'between' })).toBe('hi')
    expect(await util.apply('only "one quote', { delimiter: '"', mode: 'between', ifMissing: 'empty' }))
      .toBe('')
  })

  it('works line by line', async () => {
    expect(await util.apply('a:1\nb:2', { delimiter: ':', mode: 'after', perLine: true })).toBe('1\n2')
    expect(await util.apply('a:1\r\nb:2', { delimiter: ':', mode: 'before', perLine: true }))
      .toBe('a\r\nb')
  })

  it('applies the ifMissing strategy', async () => {
    expect(await util.apply('hello', { delimiter: '@', ifMissing: 'whole' })).toBe('hello')
    expect(await util.apply('hello', { delimiter: '@', ifMissing: 'empty' })).toBe('')
    expect(() => util.apply('hello', { delimiter: '@', ifMissing: 'error' })).toThrow(/not found/)
    expect(() => util.apply('a:1\nb', { delimiter: ':', perLine: true, ifMissing: 'error' }))
      .toThrow(/line 2/)
  })

  it('pairs the last span when one marker is reused', async () => {
    expect(await util.apply('a"b"c"d', { delimiter: '"', mode: 'between', occurrence: 'last' })).toBe('c')
    expect(await util.apply('a"b"c"d', { delimiter: '"', mode: 'between', occurrence: 'first' })).toBe('b')
    expect(await util.apply('a""b', { delimiter: '"', mode: 'between' })).toBe('')
  })

  it('ignores the end delimiter outside between mode', async () => {
    expect(await util.apply('a:b;c', { delimiter: ':', mode: 'after', endDelimiter: ';' })).toBe('b;c')
    expect(await util.apply('a:b;c', { delimiter: ':', mode: 'before', endDelimiter: ';' })).toBe('a')
  })

  it('returns empty string for empty input', async () => {
    expect(await util.apply('', { delimiter: '@' })).toBe('')
    expect(await util.apply('', {})).toBe('')
  })

  it('handles emoji delimiters and content', async () => {
    expect(await util.apply('🎉 party 🎉 time', { delimiter: '🎉', mode: 'after', occurrence: 'last' }))
      .toBe(' time')
    expect(await util.apply('naïve → café', { delimiter: ' → ', mode: 'before' })).toBe('naïve')
  })

  it('understands backslash escapes in the delimiters', async () => {
    expect(await util.apply('key\tvalue', { delimiter: '\\t', mode: 'after' })).toBe('value')
  })

  it('throws when no delimiter is given', () => {
    expect(() => util.apply('hello', {})).toThrow(/delimiter/)
    expect(() => util.apply('hello', { delimiter: '', mode: 'between' })).toThrow(/delimiter/)
  })
})
