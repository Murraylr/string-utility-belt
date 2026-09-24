import { describe, it, expect } from 'vitest'
import util from './index'

const CSV = 'name,age,city\nAlice,30,Paris\nBob,25,Berlin'

describe('csv_columns', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('csv_columns')
    expect(util.name).toBe('csv select columns')
    expect(util.category).toBe('Data Formats')
    expect(util.accepts).toBe('string')
    expect(util.produces).toBe('string')
    expect(Object.keys(util.params).sort()).toEqual(['columns', 'delimiter', 'header', 'mode'])
  })

  it('keeps and reorders columns by name', async () => {
    expect(await util.apply(CSV, { columns: 'city, name', mode: 'keep' })).toBe(
      'city,name\nParis,Alice\nBerlin,Bob'
    )
  })

  it('matches column names case-insensitively', async () => {
    expect(await util.apply(CSV, { columns: 'AGE' })).toBe('age\n30\n25')
  })

  it('drops the listed columns in drop mode', async () => {
    expect(await util.apply(CSV, { columns: 'age', mode: 'drop' })).toBe(
      'name,city\nAlice,Paris\nBob,Berlin'
    )
  })

  it('selects by 1-based index when there is no header row', async () => {
    expect(await util.apply('a,b,c\nd,e,f', { columns: '3,1', header: false })).toBe('c,a\nf,d')
  })

  it('drops by 1-based index with the header row off', async () => {
    expect(await util.apply('a,b,c\n1,2,3', { columns: '2', mode: 'drop', header: false })).toBe(
      'a,c\n1,3'
    )
  })

  it('can repeat a column and drop every column', async () => {
    expect(await util.apply('a,b\n1,2', { columns: 'a,a,b' })).toBe('a,a,b\n1,1,2')
    expect(await util.apply('a,b\n1,2', { columns: 'a,b', mode: 'drop' })).toBe('')
  })

  it('honours an explicit delimiter, including \\t', async () => {
    expect(await util.apply('a;b\n1;2', { columns: 'b', delimiter: ';' })).toBe('b\n2')
    expect(await util.apply('a\tb\n1\t2', { columns: 'a', delimiter: '\\t' })).toBe('a\n1')
  })

  it('auto-detects the delimiter', async () => {
    expect(await util.apply('a\tb\n1\t2', { columns: 'b', delimiter: 'auto' })).toBe('b\n2')
    expect(await util.apply('a;b\n1;2', { columns: 'a' })).toBe('a\n1')
  })

  it('re-quotes fields that contain the delimiter or a quote', async () => {
    expect(await util.apply('a,b\n"x,y",z', { columns: 'a' })).toBe('a\n"x,y"')
    expect(await util.apply('a,b\n"he said ""hi""",z', { columns: 'a' })).toBe(
      'a\n"he said ""hi"""'
    )
  })

  it('preserves non-ASCII names and values', async () => {
    const csv = 'prénom,âge\nJosé,30\n😀,7'
    expect(await util.apply(csv, { columns: 'prénom' })).toBe('prénom\nJosé\n😀')
    expect(await util.apply(csv, { columns: 'PRÉNOM', mode: 'drop' })).toBe('âge\n30\n7')
  })

  it('pads short rows and preserves line endings', async () => {
    expect(await util.apply('a,b,c\n1,2', { columns: 'c' })).toBe('c\n')
    expect(await util.apply('a,b\r\n1,2', { columns: 'b' })).toBe('b\r\n2')
    expect(await util.apply('name,age\nA,1\n', { columns: 'name' })).toBe('name\nA\n')
  })

  it('returns the table unchanged when no columns are listed', async () => {
    expect(await util.apply(CSV, { columns: '' })).toBe(CSV)
    expect(await util.apply(CSV, { columns: '  ', mode: 'drop' })).toBe(CSV)
  })

  it('handles empty input without throwing', async () => {
    expect(await util.apply('', { columns: 'name' })).toBe('')
    expect(await util.apply('   \n  ', { columns: 'name' })).toBe('')
  })

  it('throws on unknown columns, bad indexes and malformed CSV', () => {
    expect(() => util.apply(CSV, { columns: 'nope' })).toThrow(/unknown column/)
    expect(() => util.apply(CSV, { columns: '9' })).toThrow(/out of range/)
    expect(() => util.apply(CSV, { columns: 'name', header: false })).toThrow(
      /1-based column index/
    )
    expect(() => util.apply('a,b\n"oops,1', { columns: 'a' })).toThrow(/unterminated quoted field/)
  })
})
