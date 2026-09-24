import { describe, it, expect } from 'vitest'
import util from './index'

describe('csv_delimiter', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('csv_delimiter')
    expect(util.name).toBe('csv change delimiter')
    expect(util.category).toBe('Data Formats')
    expect(util.accepts).toBe('string')
    expect(util.produces).toBe('string')
  })

  it('converts comma to tab by default', async () => {
    expect(await util.apply('a,b\n1,2', {})).toBe('a\tb\n1\t2')
  })

  it('returns empty output for empty input', async () => {
    expect(await util.apply('', {})).toBe('')
    expect(await util.apply('\n\n', {})).toBe('')
  })

  it('drops quoting that is no longer needed', async () => {
    expect(await util.apply('a,b\n"x,y",2', { to: '|' })).toBe('a|b\nx,y|2')
  })

  it('adds quoting that the new delimiter requires', async () => {
    // auto-detects tab as the source delimiter, then must quote the comma
    expect(await util.apply('a\tb\nx,y\t2', { to: ',' })).toBe('a,b\n"x,y",2')
    expect(await util.apply('a,b\n"x\ny",2', { to: '|' })).toBe('a|b\n"x\ny"|2')
    expect(await util.apply('a,b\n"say ""hi""",2', { to: ';' })).toBe('a;b\n"say ""hi""";2')
  })

  it('honours an explicit from delimiter and delimiter names', async () => {
    expect(await util.apply('a;b\n1;2', { from: ';', to: ',' })).toBe('a,b\n1,2')
    expect(await util.apply('a|b\n1|2', { from: 'pipe', to: 'comma' })).toBe('a,b\n1,2')
    expect(await util.apply('a\tb\n1\t2', { from: '\\t', to: ';' })).toBe('a;b\n1;2')
  })

  it('auto-detects semicolon and pipe sources', async () => {
    expect(await util.apply('a;b;c\n1;2;3', { from: 'auto', to: ',' })).toBe('a,b,c\n1,2,3')
    expect(await util.apply('a|b|c\n1|2|3', { to: ',' })).toBe('a,b,c\n1,2,3')
  })

  it('quotes every field when quoteAll is on', async () => {
    expect(await util.apply('a,b\n1,2', { to: ';', quoteAll: true })).toBe('"a";"b"\n"1";"2"')
    expect(await util.apply('a,b\n1,2', { to: ';', quoteAll: false })).toBe('a;b\n1;2')
  })

  it('preserves crlf line endings and non-ASCII content', async () => {
    expect(await util.apply('a,b\r\n1,2', {})).toBe('a\tb\r\n1\t2')
    expect(await util.apply('a,b\n👩‍🚀,café', { to: '|' })).toBe('a|b\n👩‍🚀|café')
  })

  it('does not mistake a crlf inside a quoted field for the row separator', async () => {
    expect(await util.apply('a,b\n"x\r\ny",2', { to: ';' })).toBe('a;b\n"x\r\ny";2')
    expect(await util.apply('a,b\r\n"x\ny",2', { to: ';' })).toBe('a;b\r\n"x\ny";2')
  })

  it('keeps a quoted empty field instead of collapsing it into a blank line', async () => {
    expect(await util.apply('a\n""\nz', { to: ';' })).toBe('a\n""\nz')
    expect(await util.apply('a\n\nz', { to: ';' })).toBe('a\nz')
  })

  it('round-trips comma to tab and back', async () => {
    const original = 'name,note\nAda,"x,y"\nGrace,"line1\nline2"'
    const tsv = String(await util.apply(original, { to: '\\t' }))
    expect(await util.apply(tsv, { from: '\\t', to: ',' })).toBe(original)
  })

  it('throws on a bad target delimiter or malformed input', () => {
    expect(() => util.apply('a,b\n1,2', { to: '"' })).toThrow(/quote character/)
    expect(() => util.apply('a,b\n1,2', { to: '\\n' })).toThrow(/line break/)
    expect(() => util.apply('a,b\n"oops,2', { to: ';' })).toThrow(/unterminated quoted field/)
  })
})
