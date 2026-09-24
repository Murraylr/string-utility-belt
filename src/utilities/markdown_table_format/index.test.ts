import { describe, it, expect } from 'vitest'
import util, { displayWidth } from './index'

const lines = (...rows: string[]) => rows.join('\n')

describe('markdown_table_format', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('markdown_table_format')
    expect(util.name).toBe('markdown table prettify')
    expect(util.category).toBe('Formatting')
    expect(util.accepts).toBe('string')
    expect(util.produces).toBe('string')
    expect(Object.keys(util.params).sort()).toEqual(['align', 'compact'])
  })

  it('declares the params from the spec, with defaults', () => {
    expect(util.params.align).toMatchObject({
      kind: 'select',
      options: ['preserve', 'left', 'center', 'right'],
      default: 'preserve'
    })
    expect(util.params.compact).toMatchObject({ kind: 'boolean', default: false })
  })

  it('applies the declared defaults when no params are passed', async () => {
    const input = lines('| a | bb |', '| :- | -: |', '| 1 | 2 |')
    expect(await util.apply(input, {})).toBe(
      await util.apply(input, { align: 'preserve', compact: false })
    )
  })

  it('pads cells so the pipes align and keeps the alignment row', async () => {
    const input = lines(
      '| Name | Qty | Price |',
      '|---|:-:|--:|',
      '| Apple | 3 | 1.50 |',
      '| Banana bread | 12 | 22.00 |'
    )
    expect(await util.apply(input, {})).toBe(
      lines(
        '| Name         | Qty | Price |',
        '| ------------ | :-: | ----: |',
        '| Apple        |  3  |  1.50 |',
        '| Banana bread | 12  | 22.00 |'
      )
    )
  })

  it('returns empty string for empty and whitespace-only input', async () => {
    expect(await util.apply('', {})).toBe('')
    expect(await util.apply('   \n  \n', {})).toBe('')
  })

  it('leaves surrounding prose untouched', async () => {
    const input = lines('# Report', '', 'Totals below:', '| a | b |', '| - | - |', '| 1 | 2 |', '', 'Done.')
    expect(await util.apply(input, {})).toBe(
      lines('# Report', '', 'Totals below:', '| a   | b   |', '| --- | --- |', '| 1   | 2   |', '', 'Done.')
    )
  })

  it('applies every align option', async () => {
    const input = lines('| ab | cd |', '| --- | --- |', '| 1 | 2 |')
    expect(await util.apply(input, { align: 'left' })).toBe(
      lines('| ab  | cd  |', '| :-- | :-- |', '| 1   | 2   |')
    )
    expect(await util.apply(input, { align: 'center' })).toBe(
      lines('| ab  | cd  |', '| :-: | :-: |', '|  1  |  2  |')
    )
    expect(await util.apply(input, { align: 'right' })).toBe(
      lines('|  ab |  cd |', '| --: | --: |', '|   1 |   2 |')
    )
    expect(await util.apply(input, { align: 'preserve' })).toBe(
      lines('| ab  | cd  |', '| --- | --- |', '| 1   | 2   |')
    )
  })

  it('supports the compact style', async () => {
    const input = lines('| Name  | Qty |', '| :---  | --: |', '| Apple | 3   |')
    expect(await util.apply(input, { compact: true })).toBe(
      lines('|Name|Qty|', '|:--|--:|', '|Apple|3|')
    )
    expect(await util.apply(input, { compact: false })).toBe(
      lines('| Name  | Qty |', '| :---- | --: |', '| Apple |   3 |')
    )
  })

  it('measures wide, combining and zero-width characters correctly', async () => {
    expect(displayWidth('😀😀')).toBe(4)
    expect(displayWidth('café')).toBe(4)
    expect(displayWidth('日本')).toBe(4)
    expect(displayWidth('e\u0301')).toBe(1) // e + combining acute
    expect(displayWidth('a\u200Bb')).toBe(2) // zero-width space
    expect(displayWidth('\u2060')).toBe(0) // word joiner
    expect(displayWidth('\u304B\u3099')).toBe(2) // ka + combining voiced mark
    const input = lines('| key | value |', '| --- | --- |', '| 😀😀 | ok |')
    expect(await util.apply(input, {})).toBe(
      lines('| key  | value |', '| ---- | ----- |', '| 😀😀 | ok    |')
    )
  })

  it('keeps astral characters whole', async () => {
    const out = String(await util.apply(lines('| a | b |', '| - | - |', '| 👨‍👩‍👧 | 🇳🇿 |'), {}))
    expect(out).toContain('👨‍👩‍👧')
    expect(out).toContain('🇳🇿')
    expect(out).not.toContain('�')
  })

  it('normalises ragged rows without losing cells', async () => {
    const input = lines('| a | b | c |', '|---|---|---|', '| 1 | 2 |', '| 1 | 2 | 3 | 4 |')
    expect(await util.apply(input, {})).toBe(
      lines(
        '| a   | b   | c   |     |',
        '| --- | --- | --- | --- |',
        '| 1   | 2   |     |     |',
        '| 1   | 2   | 3   | 4   |'
      )
    )
  })

  it('preserves tables written without outer pipes', async () => {
    const input = lines('a | b', '--- | ---', '1 | 2')
    expect(await util.apply(input, {})).toBe(lines('a   | b', '--- | ---', '1   | 2'))
  })

  it('never indents a table that has no opening pipe', async () => {
    // Four leading spaces would turn the whole table into an indented code block.
    const input = lines('name | v', '---: | ---', 'x | 1', 'a-very-long-name | 2')
    for (const align of ['preserve', 'right', 'center']) {
      const rows = String(await util.apply(input, { align })).split('\n')
      expect(rows.every((row) => !/^\s/.test(row))).toBe(true)
      // The first pipe still lines up on every row, so the padding still works.
      expect(new Set(rows.map((row) => row.indexOf('|'))).size).toBe(1)
    }
  })

  it('does not split on escaped pipes', async () => {
    const input = lines('| a | b |', '|---|---|', '| x \\| y | z |')
    expect(await util.apply(input, {})).toBe(
      lines('| a      | b   |', '| ------ | --- |', '| x \\| y | z   |')
    )
  })

  it('formats several tables in one document', async () => {
    const input = lines('| a | b |', '| - | - |', '| 1 | 2 |', '', '| c |', '| - |', '| 3 |')
    expect(await util.apply(input, {})).toBe(
      lines('| a   | b   |', '| --- | --- |', '| 1   | 2   |', '', '| c   |', '| --- |', '| 3   |')
    )
  })

  it('keeps a table inside a block quote quoted', async () => {
    const input = lines('> | a | b |', '> | - | - |', '> | 1 | 2 |')
    expect(await util.apply(input, {})).toBe(
      lines('> | a   | b   |', '> | --- | --- |', '> | 1   | 2   |')
    )
  })

  it('keeps a table indented inside its list item', async () => {
    const input = lines('1. step', '', '   | a | b |', '   | - | - |', '   | 1 | 2 |')
    expect(await util.apply(input, {})).toBe(
      lines('1. step', '', '   | a   | b   |', '   | --- | --- |', '   | 1   | 2   |')
    )
  })

  it('never rewrites a table inside a fenced code block', async () => {
    const input = lines(
      '```md',
      '| a | b |',
      '| - | - |',
      '```',
      '',
      '| x | y |',
      '| - | - |',
      '| 1 | 2 |'
    )
    expect(await util.apply(input, {})).toBe(
      lines(
        '```md',
        '| a | b |',
        '| - | - |',
        '```',
        '',
        '| x   | y   |',
        '| --- | --- |',
        '| 1   | 2   |'
      )
    )
    // A table that only exists inside a fence is not a table to format.
    expect(() => util.apply(lines('~~~', '| a | b |', '| - | - |', '~~~'), {})).toThrow(
      /no markdown table found/
    )
  })

  it('preserves CRLF and lone-CR line endings', async () => {
    expect(await util.apply('| a | b |\r\n|---|---|\r\n| 1 | 2 |', {})).toBe(
      '| a   | b   |\r\n| --- | --- |\r\n| 1   | 2   |'
    )
    expect(await util.apply('| a | b |\r|---|---|\r| 1 | 2 |', {})).toBe(
      '| a   | b   |\r| --- | --- |\r| 1   | 2   |'
    )
  })

  it('is idempotent — formatting its own output changes nothing', async () => {
    const input = lines('| Name | Qty | Price |', '|---|:-:|--:|', '| Apple | 3 | 1.50 |')
    for (const params of [{}, { compact: true }, { align: 'center' }]) {
      const once = String(await util.apply(input, params))
      expect(await util.apply(once, params)).toBe(once)
    }
  })

  it('throws when there is no table to format', () => {
    expect(() => util.apply('just some prose', {})).toThrow(/no markdown table found/)
    // A horizontal rule is not a delimiter row.
    expect(() => util.apply(lines('heading', '---', 'body'), {})).toThrow(/no markdown table found/)
    // Header and delimiter must have the same number of columns.
    expect(() => util.apply(lines('| a | b |', '| --- |'), {})).toThrow(/no markdown table found/)
    // A quoted header with an unquoted delimiter is not one table.
    expect(() => util.apply(lines('> | a | b |', '| - | - |'), {})).toThrow(/no markdown table found/)
  })
})
