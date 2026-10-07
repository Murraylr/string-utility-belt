import { describe, it, expect } from 'vitest'
import util from './index'
import csvToJson from '../csv_to_json/index'

describe('json_to_csv', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('json_to_csv')
    expect(util.name).toBe('json to csv')
    expect(util.category).toBe('Data Formats')
    expect(util.accepts).toEqual(['string', 'json'])
    expect(util.produces).toBe('string')
  })

  it('converts an array of objects with a header row', async () => {
    const json = '[{"name":"Ada","age":36},{"name":"Grace","age":45}]'
    expect(await util.apply(json, {})).toBe('name,age\nAda,36\nGrace,45')
  })

  it('returns empty output for empty input', async () => {
    expect(await util.apply('', {})).toBe('')
    expect(await util.apply('   ', {})).toBe('')
    expect(await util.apply('[]', {})).toBe('')
  })

  it('uses the union of keys and quotes per RFC 4180', async () => {
    const json = '[{"a":"x,y"},{"b":"say \\"hi\\""}]'
    expect(await util.apply(json, {})).toBe('a,b\n"x,y",\n,"say ""hi"""')
  })

  it('quotes fields containing newlines', async () => {
    const json = '[{"note":"line1\\nline2"}]'
    expect(await util.apply(json, {})).toBe('note\n"line1\nline2"')
  })

  it('preserves non-ASCII and astral characters', async () => {
    const json = '[{"emoji":"👩‍🚀","city":"São Paulo"}]'
    expect(await util.apply(json, {})).toBe('emoji,city\n👩‍🚀,São Paulo')
  })

  it('honours the delimiter param, including escapes and names', async () => {
    const json = '[{"a":1,"b":2}]'
    expect(await util.apply(json, { delimiter: ';' })).toBe('a;b\n1;2')
    expect(await util.apply(json, { delimiter: '\\t' })).toBe('a\tb\n1\t2')
    expect(await util.apply(json, { delimiter: 'pipe' })).toBe('a|b\n1|2')
  })

  it('re-quotes for the chosen delimiter', async () => {
    const json = '[{"a":"x;y"}]'
    expect(await util.apply(json, { delimiter: ';' })).toBe('a\n"x;y"')
    expect(await util.apply(json, { delimiter: ',' })).toBe('a\nx;y')
  })

  it('omits the header row when header is false', async () => {
    const json = '[{"name":"Ada"},{"name":"Grace"}]'
    expect(await util.apply(json, { header: false })).toBe('Ada\nGrace')
    expect(await util.apply(json, { header: true })).toBe('name\nAda\nGrace')
  })

  it('json-stringifies nested values by default and flattens on request', async () => {
    const json = '[{"user":{"name":"Ada"},"tags":["x","y"]}]'
    expect(await util.apply(json, { flatten: false })).toBe(
      'user,tags\n"{""name"":""Ada""}","[""x"",""y""]"'
    )
    expect(await util.apply(json, { flatten: true })).toBe('user.name,tags[0],tags[1]\nAda,x,y')
  })

  it('supports crlf line endings', async () => {
    const json = '[{"a":1},{"a":2}]'
    expect(await util.apply(json, { eol: 'crlf' })).toBe('a\r\n1\r\n2')
    expect(await util.apply(json, { eol: 'lf' })).toBe('a\n1\n2')
  })

  it('picks and orders columns', async () => {
    const json = '[{"a":1,"b":2,"c":3}]'
    expect(await util.apply(json, { columns: 'c, a' })).toBe('c,a\n3,1')
  })

  it('handles arrays of arrays, single objects and primitives', async () => {
    expect(await util.apply('[["a","b"],[1,2]]', {})).toBe('a,b\n1,2')
    expect(await util.apply('[["a","b"],[1,2]]', { columns: '2' })).toBe('b\n2')
    expect(await util.apply('{"a":1,"b":2}', {})).toBe('a,b\n1,2')
    expect(await util.apply('[1,2]', {})).toBe('value\n1\n2')
  })

  it('drops row 0 of a matrix when header is false', async () => {
    expect(await util.apply('[["a","b"],[1,2],[3,4]]', { header: false })).toBe('1,2\n3,4')
    expect(await util.apply('[["a","b"],[1,2],[3,4]]', { header: true })).toBe('a,b\n1,2\n3,4')
  })

  it('quotes leading and trailing whitespace so it survives a trimming reader', async () => {
    expect(await util.apply('[{"a":"  x  ","b":"y"}]', {})).toBe('a,b\n"  x  ",y')
    expect(await util.apply('[{"a":"\\t"}]', {})).toBe('a\n"\t"')
  })

  it('round-trips through csv_to_json, including unicode and quoted specials', async () => {
    const original = [
      {
        name: 'Ada Lovelace',
        note: 'x,y',
        quote: 'say "hi"',
        bio: 'line1\nline2',
        pad: '  spaced  ',
        emoji: '👩‍🚀',
      },
      { name: 'Grace', note: 'São Paulo; 1;2', quote: '', bio: '', pad: '', emoji: '' },
    ]
    const csv = String(await util.apply(JSON.stringify(original), {}))
    expect(csv.split('\n')[0]).toBe('name,note,quote,bio,pad,emoji')
    expect(JSON.parse(String(await csvToJson.apply(csv, {})))).toEqual(original)

    // numbers survive the trip when the reader is asked to type values
    const numbers = [{ n: 36, big: 1.5, neg: -2 }]
    const numCsv = String(await util.apply(JSON.stringify(numbers), {}))
    expect(numCsv).toBe('n,big,neg\n36,1.5,-2')
    expect(JSON.parse(String(await csvToJson.apply(numCsv, { typed: true })))).toEqual(numbers)
  })

  it('writes an empty value in a one-column table as "" so it is not read as a blank line', async () => {
    const original = [{ email: 'a' }, { email: '' }, { email: 'b' }, { email: '' }]
    const csv = String(await util.apply(JSON.stringify(original), {}))
    expect(csv).toBe('email\na\n""\nb\n""')
    expect(JSON.parse(String(await csvToJson.apply(csv, {})))).toEqual(original)

    expect(await util.apply('[{"email":""}]', { eol: 'crlf' })).toBe('email\r\n""')
    expect(await util.apply('[{"":"x"}]', {})).toBe('""\nx')
    expect(await util.apply('[["h"],[""],["x"]]', {})).toBe('h\n""\nx')
    // two or more columns already carry a delimiter, so they stay unquoted
    expect(await util.apply('[{"a":"","b":""}]', {})).toBe('a,b\n,')
  })

  it('round-trips crlf and tab-delimited output', async () => {
    const original = [{ a: 'one', b: 'two' }]
    const csv = String(await util.apply(JSON.stringify(original), { eol: 'crlf', delimiter: '\\t' }))
    expect(csv).toBe('a\tb\r\none\ttwo')
    expect(JSON.parse(String(await csvToJson.apply(csv, { delimiter: '\\t' })))).toEqual(original)
  })

  it('renders null and boolean cells predictably', async () => {
    const json = '[{"a":null,"b":false,"c":0}]'
    expect(await util.apply(json, {})).toBe('a,b,c\n,false,0')
  })

  it('accepts a JSON value straight from a previous step', async () => {
    expect(await util.apply({ a: 1, b: 'two' } as any, {})).toBe('a,b\n1,two')
  })

  it('throws on invalid JSON and unknown columns', () => {
    expect(() => util.apply('{not json', {})).toThrow(/invalid JSON/)
    expect(() => util.apply('[{"a":1}]', { columns: 'zzz' })).toThrow(/unknown column: zzz/)
    expect(() => util.apply('[{"a":1}]', { delimiter: '"' })).toThrow(/quote character/)
  })

  it('throws instead of emitting blanks for an out-of-range matrix column index', () => {
    expect(() => util.apply('[["a","b"],[1,2]]', { columns: '5' })).toThrow(/unknown column: 5/)
    expect(() => util.apply('[["a","b"],[1,2]]', { columns: 'zzz' })).toThrow(/unknown column: zzz/)
  })
})
