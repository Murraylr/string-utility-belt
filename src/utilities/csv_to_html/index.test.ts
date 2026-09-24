import { describe, it, expect } from 'vitest'
import util from './index'
import fromHtml from '../html_table_to_csv/index'

describe('csv_to_html', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('csv_to_html')
    expect(util.name).toBe('csv to html table')
    expect(util.category).toBe('Data Formats')
    expect(util.accepts).toBe('string')
    expect(util.produces).toBe('string')
    expect(Object.keys(util.params).sort()).toEqual(['className', 'delimiter', 'header', 'indent'])
  })

  it('renders a header row and body rows', async () => {
    expect(await util.apply('a,b\n1,2', {})).toBe(
      [
        '<table>',
        '  <thead>',
        '    <tr>',
        '      <th>a</th>',
        '      <th>b</th>',
        '    </tr>',
        '  </thead>',
        '  <tbody>',
        '    <tr>',
        '      <td>1</td>',
        '      <td>2</td>',
        '    </tr>',
        '  </tbody>',
        '</table>'
      ].join('\n')
    )
  })

  it('returns empty string for empty input', async () => {
    expect(await util.apply('', {})).toBe('')
    expect(await util.apply('   \n  ', {})).toBe('')
  })

  it('omits thead when header is false and emits one when it is true', async () => {
    expect(await util.apply('1,2', { header: false })).toBe(
      ['<table>', '  <tbody>', '    <tr>', '      <td>1</td>', '      <td>2</td>', '    </tr>', '  </tbody>', '</table>'].join('\n')
    )
    const withHeader = await util.apply('1,2', { header: true })
    expect(withHeader).toContain('<thead>')
    expect(withHeader).toContain('<th>1</th>')
    expect(withHeader).not.toContain('<td>')
  })

  it('honours the className param', async () => {
    expect(await util.apply('a,b\n1,2', { className: 'table striped' })).toContain('<table class="table striped">')
    expect(await util.apply('a,b\n1,2', { className: '' })).toContain('<table>\n')
  })

  it('honours the indent param', async () => {
    expect(await util.apply('a\n1', { indent: 0 })).toBe(
      ['<table>', '<thead>', '<tr>', '<th>a</th>', '</tr>', '</thead>', '<tbody>', '<tr>', '<td>1</td>', '</tr>', '</tbody>', '</table>'].join('\n')
    )
    expect(await util.apply('a\n1', { indent: 4 })).toContain('\n    <thead>\n')
  })

  it('auto-detects semicolon and tab delimiters and accepts explicit ones', async () => {
    expect(await util.apply('a;b\n1;2', {})).toContain('<th>b</th>')
    expect(await util.apply('a\tb\n1\t2', {})).toContain('<th>b</th>')
    expect(await util.apply('a|b\n1|2', { delimiter: '|' })).toContain('<td>2</td>')
    expect(await util.apply('a\tb\n1\t2', { delimiter: '\\t' })).toContain('<td>1</td>')
    // a backslash-escaped literal delimiter is unescaped, not used verbatim
    expect(await util.apply('a|b\n1|2', { delimiter: '\\|' })).toContain('<th>b</th>')
    expect(await util.apply('a\\b\n1\\2', { delimiter: '\\\\' })).toContain('<th>b</th>')
    // an explicit delimiter that is not present leaves the whole line as one cell
    expect(await util.apply('a;b\n1;2', { delimiter: ',' })).toContain('<th>a;b</th>')
  })

  it('escapes html-significant characters', async () => {
    const out = await util.apply('tag\n<b>&"\'', {})
    expect(out).toContain('<td>&lt;b&gt;&amp;&quot;&#39;</td>')
    expect(out).not.toContain('<td><b>')
  })

  it('preserves astral unicode characters', async () => {
    const out = await util.apply('emoji,word\n\u{1F600}\u{1F1FA}\u{1F1F8},café', {})
    expect(out).toContain('<td>\u{1F600}\u{1F1FA}\u{1F1F8}</td>')
    expect(out).toContain('<td>café</td>')
  })

  it('handles quoted fields with embedded delimiters and newlines', async () => {
    const out = await util.apply('name,note\n"Smith, John","line1\nline2"', {})
    expect(out).toContain('<td>Smith, John</td>')
    // a raw newline would render as a space, so it has to become a <br>
    expect(out).toContain('<td>line1<br>line2</td>')
    expect(out).not.toContain('line1\nline2')
  })

  it('escapes a cell before turning its newlines into <br>', async () => {
    expect(await util.apply('h\n"<i>\r\na&b"', {})).toContain('<td>&lt;i&gt;<br>a&amp;b</td>')
  })

  it('pads short rows so every row has the same cell count', async () => {
    const out = await util.apply('a,b,c\n1', {})
    expect(out).toBe(
      [
        '<table>',
        '  <thead>',
        '    <tr>',
        '      <th>a</th>',
        '      <th>b</th>',
        '      <th>c</th>',
        '    </tr>',
        '  </thead>',
        '  <tbody>',
        '    <tr>',
        '      <td>1</td>',
        '      <td></td>',
        '      <td></td>',
        '    </tr>',
        '  </tbody>',
        '</table>'
      ].join('\n')
    )
  })

  it('throws on an unterminated quoted field', () => {
    expect(() => util.apply('a,b\n"oops,1', {})).toThrow(/unterminated quoted field/)
  })

  it('round-trips through html_table_to_csv, unicode included', async () => {
    const csv = 'name,city\nAda,Zürich\n\u{1F600},Tokyo'
    const html = await util.apply(csv, {})
    expect(await fromHtml.apply(html as string, {})).toBe(csv)
  })

  it('round-trips a cell that contains an embedded newline', async () => {
    const csv = 'name,note\nAda,"line1\nline2"'
    const html = await util.apply(csv, {})
    expect(await fromHtml.apply(html as string, {})).toBe(csv)
  })
})
