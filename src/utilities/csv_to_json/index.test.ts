import { describe, it, expect } from 'vitest'
import util, { parseCsv, detectDelimiter } from './index'
import jsonToCsv from '../json_to_csv/index'

const parse = async (input: string, params: Record<string, unknown> = {}) =>
  JSON.parse(String(await util.apply(input, params)))

describe('csv_to_json', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('csv_to_json')
    expect(util.name).toBe('csv to json')
    expect(util.category).toBe('Data Formats')
    expect(util.accepts).toBe('string')
    expect(util.produces).toBe('string')
  })

  it('converts a header row into object keys', async () => {
    expect(await parse('name,age\nAda,36\nGrace,45')).toEqual([
      { name: 'Ada', age: '36' },
      { name: 'Grace', age: '45' },
    ])
  })

  it('returns an empty array for empty input', async () => {
    expect(await util.apply('', {})).toBe('[]')
    expect(await util.apply('   \n  ', {})).toBe('[]')
  })

  it('parses quoted fields with embedded delimiters, newlines and "" escapes', async () => {
    const csv = 'a,b\n"x,y","line1\nline2"\n"say ""hi""",2'
    expect(await parse(csv)).toEqual([
      { a: 'x,y', b: 'line1\nline2' },
      { a: 'say "hi"', b: '2' },
    ])
  })

  it('auto-detects the delimiter and honours an explicit one', async () => {
    expect(await parse('a;b\n1;2')).toEqual([{ a: '1', b: '2' }])
    expect(await parse('a\tb\n1\t2')).toEqual([{ a: '1', b: '2' }])
    expect(await parse('a|b\n1|2', { delimiter: 'pipe' })).toEqual([{ a: '1', b: '2' }])
    expect(await parse('a;b\n1;2', { delimiter: ';' })).toEqual([{ a: '1', b: '2' }])
    // an explicit delimiter that is not present leaves the row as one field
    expect(await parse('a;b\n1;2', { delimiter: ',' })).toEqual([{ 'a;b': '1;2' }])
  })

  it('emits arrays of arrays when header is false', async () => {
    expect(await parse('a,b\n1,2', { header: false })).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ])
    expect(await parse('a,b\n1,2', { header: true })).toEqual([{ a: '1', b: '2' }])
  })

  it('coerces scalars when typed is on', async () => {
    const csv = 'n,ok,nothing,zip,big\n42,true,null,01234,12345678901234567890'
    expect(await parse(csv, { typed: true })).toEqual([
      { n: 42, ok: true, nothing: null, zip: '01234', big: '12345678901234567890' },
    ])
    expect(await parse(csv, { typed: false })).toEqual([
      { n: '42', ok: 'true', nothing: 'null', zip: '01234', big: '12345678901234567890' },
    ])
    expect(await parse('a,b\n-1.5,false', { typed: true })).toEqual([{ a: -1.5, b: false }])
  })

  it('trims fields by default and keeps whitespace when trim is off', async () => {
    expect(await parse('a, b\n1, 2', { trim: true })).toEqual([{ a: '1', b: '2' }])
    expect(await parse('a, b\n1, 2', { trim: false })).toEqual([{ a: '1', ' b': ' 2' }])
  })

  it('honours the indent param', async () => {
    expect(await util.apply('a\n1', { indent: 0 })).toBe('[{"a":"1"}]')
    expect(await util.apply('a\n1', { indent: 2 })).toBe('[\n  {\n    "a": "1"\n  }\n]')
  })

  it('preserves non-ASCII and astral characters', async () => {
    expect(await parse('city,emoji\nSão Paulo,👩‍🚀')).toEqual([{ city: 'São Paulo', emoji: '👩‍🚀' }])
  })

  it('names blank and duplicate headers, and keeps extra fields', async () => {
    expect(await parse('a,,a\n1,2,3')).toEqual([{ a: '1', column_2: '2', a_2: '3' }])
    expect(await parse('a,b\n1,2,3')).toEqual([{ a: '1', b: '2', column_3: '3' }])
  })

  it('never lets an extra field overwrite a header column of the same name', async () => {
    expect(await parse('a,column_3\n1,2,3')).toEqual([
      { a: '1', column_3: '2', column_3_2: '3' },
    ])
    // the key set is the same for every record, so short rows are filled in
    expect(await parse('a,b\n1,2,3\n4,5')).toEqual([
      { a: '1', b: '2', column_3: '3' },
      { a: '4', b: '5', column_3: '' },
    ])
  })

  it('keeps a quoted empty field as a row instead of treating it as a blank line', async () => {
    expect(await parse('a\n""\n"  "\nz')).toEqual([{ a: '' }, { a: '  ' }, { a: 'z' }])
    expect(await parse('a\n\nz')).toEqual([{ a: 'z' }])
  })

  it('leaves quoted fields alone when trimming', async () => {
    expect(await parse('a,b\n" x ", y ', { trim: true })).toEqual([{ a: ' x ', b: 'y' }])
    expect(await parse('a,b\n" x ", y ', { trim: false })).toEqual([{ a: ' x ', b: ' y ' }])
  })

  it('accepts a backslash-escaped tab as the delimiter', async () => {
    expect(await parse('a\tb\n1\t2', { delimiter: '\\t' })).toEqual([{ a: '1', b: '2' }])
  })

  it('round-trips back through json_to_csv, including unicode and quoted specials', async () => {
    const csv = 'name,note,pad\nAda,"x,y","  spaced  "\nGrace,"say ""hi""",👩‍🚀'
    const records = await parse(csv)
    expect(records).toEqual([
      { name: 'Ada', note: 'x,y', pad: '  spaced  ' },
      { name: 'Grace', note: 'say "hi"', pad: '👩‍🚀' },
    ])
    expect(await jsonToCsv.apply(JSON.stringify(records), {})).toBe(csv)
  })

  it('fills missing trailing fields and skips blank lines', async () => {
    expect(await parse('a,b\n1\n\n2,3')).toEqual([
      { a: '1', b: '' },
      { a: '2', b: '3' },
    ])
  })

  it('throws on an unterminated quoted field', () => {
    expect(() => util.apply('a,b\n"oops,2', {})).toThrow(/unterminated quoted field/)
  })

  it('reports per-field quoting and row separators from the parser', () => {
    const parsed = parseCsv('a,b\r\n"",x\r\n', ',')
    expect(parsed.rows).toEqual([
      ['a', 'b'],
      ['', 'x'],
    ])
    expect(parsed.quoted).toEqual([
      [false, false],
      [true, false],
    ])
    expect(parsed.crlf).toBe(true)
    // a crlf inside a quoted field is content, not a row separator
    expect(parseCsv('a,"x\r\ny"\n', ',').crlf).toBe(false)
    expect(detectDelimiter('a;b\n1;2')).toBe(';')
    expect(detectDelimiter('a,b\n1,2')).toBe(',')
    expect(detectDelimiter('no delimiters here')).toBe(',')
  })
})
