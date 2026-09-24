import { describe, it, expect } from 'vitest'
import util from './index'
import toHtml from '../csv_to_html/index'

const TABLE = '<table><tr><th>a</th><th>b</th></tr><tr><td>1</td><td>2</td></tr></table>'

describe('html_table_to_csv', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('html_table_to_csv')
    expect(util.name).toBe('html table to csv')
    expect(util.category).toBe('Data Formats')
    expect(util.accepts).toBe('string')
    expect(util.produces).toBe('string')
    expect(Object.keys(util.params).sort()).toEqual(['delimiter', 'tableIndex'])
  })

  it('converts a simple table', async () => {
    expect(await util.apply(TABLE, {})).toBe('a,b\n1,2')
  })

  it('returns empty string for empty input', async () => {
    expect(await util.apply('', {})).toBe('')
    expect(await util.apply('  \n ', {})).toBe('')
  })

  it('picks the nth table via tableIndex', async () => {
    const two = `${TABLE}<table><tr><td>x</td><td>y</td></tr></table>`
    expect(await util.apply(two, { tableIndex: 0 })).toBe('a,b\n1,2')
    expect(await util.apply(two, { tableIndex: 1 })).toBe('x,y')
    expect(await util.apply(two, { tableIndex: -1 })).toBe('x,y')
  })

  it('honours the delimiter param', async () => {
    expect(await util.apply(TABLE, { delimiter: ';' })).toBe('a;b\n1;2')
    expect(await util.apply(TABLE, { delimiter: '\\t' })).toBe('a\tb\n1\t2')
    // a backslash-escaped literal delimiter is unescaped, not used verbatim
    expect(await util.apply(TABLE, { delimiter: '\\|' })).toBe('a|b\n1|2')
    expect(await util.apply('<table><tr><td>x;y</td><td>z</td></tr></table>', { delimiter: ';' })).toBe('"x;y";z')
  })

  it('treats <br> and <br /> alike as a line break inside a cell', async () => {
    expect(await util.apply('<table><tr><td>a<br>b</td><td>c<br />d</td></tr></table>', {}))
      .toBe('"a\nb","c\nd"')
  })

  it('expands colspan across the columns it covers', async () => {
    const html =
      '<table><tr><td colspan="2">span</td><td>x</td></tr><tr><td>1</td><td>2</td><td>3</td></tr></table>'
    expect(await util.apply(html, {})).toBe('span,span,x\n1,2,3')
  })

  it('quotes fields that contain the delimiter, quotes or newlines', async () => {
    const html = '<table><tr><td>Smith, John</td><td>say "hi"</td><td>a<br>b</td></tr></table>'
    expect(await util.apply(html, {})).toBe('"Smith, John","say ""hi""","a\nb"')
  })

  it('decodes entities and keeps astral unicode intact', async () => {
    const html = '<table><tr><td>&amp;&lt;b&gt;</td><td>caf&eacute; \u{1F600}</td></tr></table>'
    expect(await util.apply(html, {})).toBe('&<b>,café \u{1F600}')
  })

  it('collapses html formatting whitespace and pads short rows', async () => {
    const html = `<table>
      <thead><tr><th>  name  </th><th>city</th></tr></thead>
      <tbody><tr><td>Ada
        Lovelace</td></tr></tbody>
    </table>`
    expect(await util.apply(html, {})).toBe('name,city\nAda Lovelace,')
  })

  it('does not treat a nested table row as a row of the outer table', async () => {
    const html =
      '<table><tr><td>outer</td></tr><tr><td><table><tr><td>inner</td></tr></table></td></tr></table>'
    expect(await util.apply(html, { tableIndex: 0 })).toBe('outer\ninner')
    expect(await util.apply(html, { tableIndex: 1 })).toBe('inner')
  })

  it('throws when there is no table', () => {
    expect(() => util.apply('<p>nothing here</p>', {})).toThrow(/no <table> found/)
  })

  it('throws when tableIndex is out of range', () => {
    expect(() => util.apply(TABLE, { tableIndex: 5 })).toThrow(/out of range/)
    expect(() => util.apply(TABLE, { tableIndex: -3 })).toThrow(/out of range/)
  })

  it('round-trips through csv_to_html, unicode included', async () => {
    const html = await toHtml.apply('word,note\ncafé,"a, b"\n\u{1F600},plain', {})
    const csv = await util.apply(html as string, {})
    expect(csv).toBe('word,note\ncafé,"a, b"\n\u{1F600},plain')
    expect(await toHtml.apply(csv as string, {})).toBe(html)
  })
})
