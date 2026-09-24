import { describe, it, expect } from 'vitest'
import util from './index'

const TAB = '\t'

describe('uniq_count', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('uniq_count')
    expect(util.name).toBe('count duplicate lines')
    expect(util.category).toBe('Lines')
    expect(util.accepts).toBe('string')
    expect(util.produces).toEqual(['string', 'json'])
  })

  it('counts repeated lines, most frequent first', async () => {
    const input = 'apple\nbanana\napple\ncherry\napple\nbanana'
    expect(await util.apply(input, {})).toBe(
      `3${TAB}apple\n2${TAB}banana\n1${TAB}cherry`
    )
  })

  it('ignores a trailing newline and tolerates CRLF', async () => {
    expect(await util.apply('a\r\nb\r\na\r\n', {})).toBe(`2${TAB}a\n1${TAB}b`)
  })

  it('returns empty output for empty input', async () => {
    expect(await util.apply('', {})).toBe('')
    expect(await util.apply('', { format: 'json' })).toEqual({
      totalLines: 0,
      uniqueLines: 0,
      entries: []
    })
  })

  it('supports every sort order', async () => {
    const input = 'banana\napple\nbanana\nCherry'
    expect(await util.apply(input, { sort: 'count-desc' })).toBe(
      `2${TAB}banana\n1${TAB}apple\n1${TAB}Cherry`
    )
    expect(await util.apply(input, { sort: 'count-asc' })).toBe(
      `1${TAB}apple\n1${TAB}Cherry\n2${TAB}banana`
    )
    // dictionary order, like the line_sort utility — NOT ASCIIbetical, which
    // would put every capitalised line first ('Cherry', 'apple', 'banana')
    expect(await util.apply(input, { sort: 'alpha' })).toBe(
      `1${TAB}apple\n2${TAB}banana\n1${TAB}Cherry`
    )
    expect(await util.apply(input, { sort: 'original' })).toBe(
      `2${TAB}banana\n1${TAB}apple\n1${TAB}Cherry`
    )
  })

  it('supports every output format', async () => {
    const input = 'a\nb\na'
    expect(await util.apply(input, { format: 'count-line' })).toBe(`2${TAB}a\n1${TAB}b`)
    expect(await util.apply(input, { format: 'line-count' })).toBe(`a${TAB}2\nb${TAB}1`)
    expect(await util.apply(input, { format: 'json' })).toEqual({
      totalLines: 3,
      uniqueLines: 2,
      entries: [
        { line: 'a', count: 2 },
        { line: 'b', count: 1 }
      ]
    })
  })

  it('honours a custom separator, including a typed escape', async () => {
    expect(await util.apply('a\na', { separator: ' | ' })).toBe('2 | a')
    expect(await util.apply('a\na', { separator: '\\t' })).toBe(`2${TAB}a`)
  })

  it('folds case and trims when asked', async () => {
    expect(await util.apply('Apple\napple', {})).toBe(`1${TAB}Apple\n1${TAB}apple`)
    expect(await util.apply('Apple\napple', { ignoreCase: true })).toBe(`2${TAB}Apple`)
    expect(await util.apply('  a  \na', { trim: true })).toBe(`2${TAB}a`)
    expect(await util.apply('  a  \na', { trim: false })).toBe(`1${TAB}  a  \n1${TAB}a`)
  })

  it('can report only the duplicated lines', async () => {
    expect(await util.apply('a\nb\na', { onlyDuplicates: true })).toBe(`2${TAB}a`)
    expect(await util.apply('a\nb', { onlyDuplicates: true })).toBe('')
    expect(await util.apply('a\nb\na', { onlyDuplicates: true, format: 'json' })).toEqual({
      totalLines: 3,
      uniqueLines: 2,
      entries: [{ line: 'a', count: 2 }]
    })
  })

  it('counts astral characters as whole lines and orders them without splitting surrogates', async () => {
    expect(await util.apply('🍎\napple\n🍎', {})).toBe(`2${TAB}🍎\n1${TAB}apple`)
    // collation sorts a symbol ahead of letters; the pair must stay whole either way
    expect(await util.apply('🍎\napple', { sort: 'alpha' })).toBe(`1${TAB}🍎\n1${TAB}apple`)
    expect(await util.apply('Ünïcode\nÜnïcode', { ignoreCase: true })).toBe(`2${TAB}Ünïcode`)
  })

  it('folds case in the alpha sort only when ignore case is on', async () => {
    const input = 'Cherry\napple\nAPPLE\nbanana'
    // case-sensitive: 'apple' and 'APPLE' stay separate but still sort together
    expect(await util.apply(input, { sort: 'alpha' })).toBe(
      `1${TAB}apple\n1${TAB}APPLE\n1${TAB}banana\n1${TAB}Cherry`
    )
    // folded: the two apples merge, and the sort agrees with the counting
    expect(await util.apply(input, { sort: 'alpha', ignoreCase: true })).toBe(
      `2${TAB}apple\n1${TAB}banana\n1${TAB}Cherry`
    )
  })

  it('rejects an unknown sort or format', () => {
    expect(() => util.apply('a', { sort: 'sideways' })).toThrow(/unknown sort/)
    expect(() => util.apply('a', { format: 'xml' })).toThrow(/unknown format/)
  })
})
