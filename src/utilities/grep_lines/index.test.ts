import { describe, it, expect } from 'vitest'
import util from './index'

const LOG = 'INFO start\nWARN disk low\nerror: boom\nINFO done\n'

describe('grep_lines', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('grep_lines')
    expect(util.name).toBe('grep lines')
    expect(util.category).toBe('Lines')
    expect(util.accepts).toBe('string')
    expect(util.produces).toBe('string')
    expect(Object.keys(util.params).sort()).toEqual([
      'context',
      'ignoreCase',
      'invert',
      'lineNumbers',
      'pattern',
      'regex',
      'wholeWord'
    ])
  })

  it('keeps only the lines containing a literal substring', async () => {
    expect(await util.apply(LOG, { pattern: 'INFO' })).toBe('INFO start\nINFO done\n')
  })

  it('returns empty string for empty input', async () => {
    expect(await util.apply('', { pattern: 'anything' })).toBe('')
    expect(await util.apply('', {})).toBe('')
  })

  it('treats a blank pattern as "match every line"', async () => {
    expect(await util.apply(LOG, {})).toBe(LOG)
    expect(await util.apply(LOG, { pattern: '' })).toBe(LOG)
  })

  it('returns empty string when nothing matches', async () => {
    expect(await util.apply(LOG, { pattern: 'zzz' })).toBe('')
  })

  it('honours ignoreCase', async () => {
    expect(await util.apply(LOG, { pattern: 'ERROR' })).toBe('')
    expect(await util.apply(LOG, { pattern: 'ERROR', ignoreCase: true })).toBe('error: boom\n')
  })

  it('honours invert', async () => {
    expect(await util.apply(LOG, { pattern: 'INFO', invert: true })).toBe(
      'WARN disk low\nerror: boom\n'
    )
  })

  it('matches a regular expression when regex is on', async () => {
    expect(await util.apply(LOG, { pattern: '^(INFO|WARN)', regex: true })).toBe(
      'INFO start\nWARN disk low\nINFO done\n'
    )
    // the same pattern as a literal matches nothing
    expect(await util.apply(LOG, { pattern: '^(INFO|WARN)' })).toBe('')
  })

  it('honours wholeWord for literal and regex searches', async () => {
    const text = 'cat\nconcatenate\nthe cat sat\n'
    expect(await util.apply(text, { pattern: 'cat' })).toBe(text)
    expect(await util.apply(text, { pattern: 'cat', wholeWord: true })).toBe('cat\nthe cat sat\n')
    expect(await util.apply(text, { pattern: 'c.t', regex: true, wholeWord: true })).toBe(
      'cat\nthe cat sat\n'
    )
  })

  it('emits context lines and grep-style group separators', async () => {
    expect(await util.apply('a\nb\nMATCH\nc\nd\n', { pattern: 'MATCH', context: 1 })).toBe(
      'b\nMATCH\nc\n'
    )
    expect(await util.apply('M\nx\nx\nx\nM\n', { pattern: 'M', context: 1 })).toBe(
      'M\nx\n--\nx\nM\n'
    )
    // context 0 never inserts a separator
    expect(await util.apply('M\nx\nx\nx\nM\n', { pattern: 'M', context: 0 })).toBe('M\nM\n')
  })

  it('prefixes line numbers with ":" for hits and "-" for context', async () => {
    expect(await util.apply(LOG, { pattern: 'INFO', lineNumbers: true })).toBe(
      '1:INFO start\n4:INFO done\n'
    )
    expect(
      await util.apply('a\nb\nMATCH\nc\nd\n', { pattern: 'MATCH', context: 1, lineNumbers: true })
    ).toBe('2-b\n3:MATCH\n4-c\n')
  })

  it('handles non-ASCII text and astral characters', async () => {
    expect(await util.apply('héllo wörld\nplain\ncafé\n', { pattern: 'é' })).toBe(
      'héllo wörld\ncafé\n'
    )
    expect(await util.apply('🎉 party\nquiet\n', { pattern: '🎉' })).toBe('🎉 party\n')
    // "café" is a whole word before a space, but not inside "cafés"
    expect(await util.apply('café au lait\ncafés\n', { pattern: 'café', wholeWord: true })).toBe(
      'café au lait\n'
    )
  })

  it('preserves CRLF endings and the absence of a trailing newline', async () => {
    expect(await util.apply('a\r\nb\r\n', { pattern: 'a' })).toBe('a\r\n')
    expect(await util.apply('a\nb', { pattern: 'b' })).toBe('b')
    // a match that is not the last line still loses the trailing newline the input never had
    expect(await util.apply('a\nb', { pattern: 'a' })).toBe('a')
  })

  it('leaves each line ending alone in a file with mixed endings', async () => {
    const mixed = 'a\r\nb\nc\nd\n'
    // the single CRLF on line 1 must not convert the LF-terminated lines
    expect(await util.apply(mixed, { pattern: 'b' })).toBe('b\n')
    expect(await util.apply(mixed, { pattern: 'a' })).toBe('a\r\n')
    expect(await util.apply(mixed, { pattern: 'c', context: 1 })).toBe('b\nc\nd\n')
    expect(await util.apply(mixed, {})).toBe(mixed)
  })

  it('combines invert with context lines', async () => {
    // context is gathered around the lines that survive the inversion
    expect(await util.apply('M\na\nM\nM\nM\n', { pattern: 'M', invert: true, context: 1 })).toBe(
      'M\na\nM\n'
    )
  })

  it('throws on an invalid regular expression', () => {
    expect(() => util.apply('abc', { pattern: '[', regex: true })).toThrow(
      /invalid regular expression/
    )
  })

  it('throws when context is not a number', () => {
    expect(() => util.apply('abc', { pattern: 'a', context: 'lots' })).toThrow(
      /context must be a finite number/
    )
  })
})
