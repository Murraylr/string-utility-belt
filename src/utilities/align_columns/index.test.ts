import { describe, it, expect } from 'vitest'
import util from './index'

describe('align_columns', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('align_columns')
    expect(util.name).toBe('align columns')
    expect(util.category).toBe('Formatting')
    expect(util.accepts).toBe('string')
    expect(util.produces).toBe('string')
    expect(Object.keys(util.params).sort()).toEqual(['align', 'delimiter', 'header', 'outputDelimiter'])
  })

  it('aligns whitespace-separated columns by default', async () => {
    const input = 'name age city\nalice 30 nyc\nbob 7 sf'
    expect(await util.apply(input, {})).toBe(
      'name   age  city\n' +
      'alice  30   nyc\n' +
      'bob    7    sf'
    )
  })

  it('collapses ragged whitespace runs and never leaves trailing spaces', async () => {
    const out = String(await util.apply('a    b   c\nd', {}))
    expect(out).toBe('a  b  c\nd')
    expect(out.split('\n').every((l) => l === l.replace(/\s+$/, ''))).toBe(true)
  })

  it('right-aligns every column when align is right', async () => {
    expect(await util.apply('a 1\nbbb 22', { align: 'right' })).toBe('  a   1\nbbb  22')
  })

  it('right-aligns only numeric columns when align is auto', async () => {
    expect(await util.apply('apples 10\nkiwi 3', { align: 'auto' })).toBe('apples  10\nkiwi     3')
  })

  it('leaves non-numeric columns left aligned under auto', async () => {
    expect(await util.apply('apples red\nkiwi green', { align: 'auto' })).toBe('apples  red\nkiwi    green')
  })

  it('supports a custom delimiter, output delimiter and header rule', async () => {
    expect(
      await util.apply('name,qty\napple,3\n', {
        delimiter: ',',
        outputDelimiter: ' | ',
        header: true
      })
    ).toBe('name  | qty\n----- | ---\napple | 3\n')
  })

  it('leaves no trailing whitespace when a row ends in empty cells', async () => {
    const out = String(await util.apply('aaaa,bbb\n,\ncc,d', { delimiter: ',' }))
    expect(out).toBe('aaaa  bbb\n\ncc    d')
    expect(out.split('\n').every((l) => l === l.replace(/[ \t]+$/, ''))).toBe(true)
  })

  it('right-aligns a numeric column under a text header only when header is set', async () => {
    // the header label must not veto the numeric vote for its own column
    expect(await util.apply('qty\n10\n5', { align: 'auto', header: true })).toBe('qty\n---\n 10\n  5')
    expect(await util.apply('qty\n10\n5', { align: 'auto' })).toBe('qty\n10\n5')
  })

  it('does not add a header rule when header is false', async () => {
    expect(await util.apply('name,qty\napple,3', { delimiter: ',' })).toBe('name   qty\napple  3')
  })

  it('accepts a backslash escape for a tab delimiter', async () => {
    expect(await util.apply('a\tbb\nccc\td', { delimiter: '\\t' })).toBe('a    bb\nccc  d')
  })

  it('measures wide CJK characters as two columns', async () => {
    expect(await util.apply('日本 x\nab y', {})).toBe('日本  x\nab    y')
  })

  it('keeps astral emoji whole and counts them as two columns', async () => {
    const out = String(await util.apply('🎉 a\nxyz b', {}))
    expect(out).toBe('🎉   a\nxyz  b')
    expect(out).toContain('🎉')
    expect(out).not.toContain('�')
  })

  it('preserves blank lines and CRLF line endings', async () => {
    expect(await util.apply('aa b\n\nc d', {})).toBe('aa  b\n\nc   d')
    expect(await util.apply('a b\r\ncc d', {})).toBe('a   b\r\ncc  d')
  })

  it('returns empty string for empty input', async () => {
    expect(await util.apply('', {})).toBe('')
    expect(await util.apply('', { align: 'auto', header: true })).toBe('')
  })

  it('throws on an empty delimiter', () => {
    expect(() => util.apply('a b', { delimiter: '' } as any)).toThrow(/delimiter must not be empty/)
  })

  it('throws on an unknown align option', () => {
    expect(() => util.apply('a b', { align: 'middle' } as any)).toThrow(/align must be one of/)
  })
})
