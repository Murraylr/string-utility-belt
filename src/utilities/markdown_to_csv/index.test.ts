import { describe, it, expect } from 'vitest'
import util from './index'
import csvToMarkdown from '../csv_to_markdown/index'

const TABLE = ['| name  | age |', '| :---- | :-- |', '| Alice | 30  |', '| Bob   | 7   |'].join(
  '\n'
)

describe('markdown_to_csv', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('markdown_to_csv')
    expect(util.name).toBe('markdown table to csv')
    expect(util.category).toBe('Data Formats')
    expect(util.accepts).toBe('string')
    expect(util.produces).toBe('string')
    expect(Object.keys(util.params)).toEqual(['delimiter'])
  })

  it('converts a pipe table, dropping the alignment row', async () => {
    expect(await util.apply(TABLE, {})).toBe('name,age\nAlice,30\nBob,7')
  })

  it('accepts tables without outer pipes', async () => {
    expect(await util.apply('name | age\n--- | ---\nAlice | 30', {})).toBe('name,age\nAlice,30')
  })

  it('honours the delimiter param, including \\t', async () => {
    expect(await util.apply(TABLE, { delimiter: ';' })).toBe('name;age\nAlice;30\nBob;7')
    expect(await util.apply(TABLE, { delimiter: '\\t' })).toBe('name\tage\nAlice\t30\nBob\t7')
  })

  it('quotes cells that contain the delimiter, a quote or a line break', async () => {
    expect(await util.apply('| a, b | c |\n| --- | --- |', {})).toBe('"a, b",c')
    expect(await util.apply('| say "hi" | c |\n| --- | --- |', {})).toBe('"say ""hi""",c')
    expect(await util.apply('| x<br>y | c |\n| --- | --- |', {})).toBe('"x\ny",c')
    expect(await util.apply('| a, b | c |\n| --- | --- |', { delimiter: ';' })).toBe('a, b;c')
  })

  it('unescapes \\| inside cells', async () => {
    expect(await util.apply('| a \\| b | c |\n| --- | --- |', {})).toBe('a | b,c')
  })

  it('ignores prose around the table and keeps non-ASCII text', async () => {
    const doc = ['Intro text', '', '| café | 東京 |', '| - | - |', '| 😀 | ok |', '', 'Outro'].join(
      '\n'
    )
    expect(await util.apply(doc, {})).toBe('café,東京\n😀,ok')
  })

  it('skips a prose line that contains a pipe directly above the table', async () => {
    expect(
      await util.apply('see a|b below\n| h1 | h2 |\n| --- | --- |\n| 1 | 2 |', {})
    ).toBe('h1,h2\n1,2')
  })

  it('prefers the block that has an alignment row over an earlier pipe in prose', async () => {
    expect(
      await util.apply('note | caution\n\n| h1 | h2 |\n| --- | --- |\n| 1 | 2 |', {})
    ).toBe('h1,h2\n1,2')
  })

  it('drops a leading alignment row that has no header above it', async () => {
    expect(await util.apply('| --- | --- |\n| 1 | 2 |', {})).toBe('1,2')
    expect(await util.apply('| --- | --- |', {})).toBe('')
  })

  it('keeps an all-dashes row that is real data, not the alignment row', async () => {
    expect(await util.apply('| a | b |\n| --- | --- |\n| --- | --- |', {})).toBe('a,b\n---,---')
  })

  it('converts a header-only table and a table with no alignment row', async () => {
    expect(await util.apply('| a | b |\n| --- | --- |', {})).toBe('a,b')
    expect(await util.apply('| a | b |\n| 1 | 2 |', {})).toBe('a,b\n1,2')
  })

  it('pads ragged rows so the csv stays rectangular', async () => {
    expect(await util.apply('| a | b |\n| --- | --- |\n| 1 |', {})).toBe('a,b\n1,')
    expect(await util.apply('| a | b |\n| --- | --- |\n| 1 | 2 | 3 |', {})).toBe('a,b,\n1,2,3')
  })

  it('round-trips with csv_to_markdown, including Unicode', async () => {
    const csv = 'name,city\nJosé,Paris\n😀,東京'
    const md = String(await csvToMarkdown.apply(csv, { delimiter: 'auto', align: 'left' }))
    expect(await util.apply(md, { delimiter: ',' })).toBe(csv)

    const tricky = 'a|b,"x,y"\n1,"line1\nline2"'
    const md2 = String(await csvToMarkdown.apply(tricky, { delimiter: ',' }))
    expect(await util.apply(md2, { delimiter: ',' })).toBe(tricky)
  })

  it('handles empty input without throwing', async () => {
    expect(await util.apply('', {})).toBe('')
    expect(await util.apply('   \n  ', {})).toBe('')
  })

  it('throws when there is no table', () => {
    expect(() => util.apply('just some prose', {})).toThrow(/no markdown table found/)
    expect(() => util.apply('a \\| b', {})).toThrow(/no markdown table found/)
  })
})
