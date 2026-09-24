import { describe, it, expect } from 'vitest'
import util from './index'

const CSV = 'name,age\nAlice,30\nBob,7'

describe('csv_to_markdown', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('csv_to_markdown')
    expect(util.name).toBe('csv to markdown table')
    expect(util.category).toBe('Data Formats')
    expect(util.accepts).toBe('string')
    expect(util.produces).toBe('string')
    expect(Object.keys(util.params).sort()).toEqual(['align', 'delimiter', 'header'])
  })

  it('builds a padded left-aligned table by default', async () => {
    expect(await util.apply(CSV, {})).toBe(
      ['| name  | age |', '| :---- | :-- |', '| Alice | 30  |', '| Bob   | 7   |'].join('\n')
    )
  })

  it('supports every align option', async () => {
    expect(await util.apply(CSV, { align: 'left' })).toBe(
      ['| name  | age |', '| :---- | :-- |', '| Alice | 30  |', '| Bob   | 7   |'].join('\n')
    )
    expect(await util.apply(CSV, { align: 'none' })).toBe(
      ['| name  | age |', '| ----- | --- |', '| Alice | 30  |', '| Bob   | 7   |'].join('\n')
    )
    expect(await util.apply(CSV, { align: 'right' })).toBe(
      ['|  name | age |', '| ----: | --: |', '| Alice |  30 |', '|   Bob |   7 |'].join('\n')
    )
    expect(await util.apply(CSV, { align: 'center' })).toBe(
      ['| name  | age |', '| :---: | :-: |', '| Alice | 30  |', '|  Bob  |  7  |'].join('\n')
    )
  })

  it('emits a blank header row when header is off', async () => {
    expect(await util.apply('a,b\n1,2', { header: false })).toBe(
      ['|     |     |', '| :-- | :-- |', '| a   | b   |', '| 1   | 2   |'].join('\n')
    )
  })

  it('escapes pipes and turns embedded newlines into <br>', async () => {
    expect(await util.apply('a|b,"x\ny"', { delimiter: ',' })).toBe(
      ['| a\\|b | x<br>y |', '| :--- | :----- |'].join('\n')
    )
  })

  it('measures column width in code points, not UTF-16 units', async () => {
    expect(await util.apply('emoji,n\n😀,1', {})).toBe(
      ['| emoji | n   |', '| :---- | :-- |', '| 😀' + ' '.repeat(4) + ' | 1   |'].join('\n')
    )
  })

  it('pads ragged rows out to the widest row', async () => {
    expect(await util.apply('a,b,c\n1,2', {})).toBe(
      ['| a   | b   | c   |', '| :-- | :-- | :-- |', '| 1   | 2   |     |'].join('\n')
    )
  })

  it('honours an explicit delimiter and auto-detection', async () => {
    expect(await util.apply('a;b\n1;2', { delimiter: ';' })).toBe(
      ['| a   | b   |', '| :-- | :-- |', '| 1   | 2   |'].join('\n')
    )
    expect(await util.apply('a\tb\n1\t2', { delimiter: '\\t' })).toBe(
      ['| a   | b   |', '| :-- | :-- |', '| 1   | 2   |'].join('\n')
    )
    expect(await util.apply('a\tb\n1\t2', { delimiter: 'auto' })).toBe(
      ['| a   | b   |', '| :-- | :-- |', '| 1   | 2   |'].join('\n')
    )
  })

  it('unwraps quoted fields containing the delimiter', async () => {
    expect(await util.apply('a,b\n"x,y",z', {})).toBe(
      ['| a   | b   |', '| :-- | :-- |', '| x,y | z   |'].join('\n')
    )
  })

  it('handles empty input without throwing', async () => {
    expect(await util.apply('', {})).toBe('')
    expect(await util.apply('  \n ', { align: 'right' })).toBe('')
  })

  it('throws on malformed CSV', () => {
    expect(() => util.apply('a,b\n"oops,1', { delimiter: ',' })).toThrow(
      /unterminated quoted field/
    )
  })
})
