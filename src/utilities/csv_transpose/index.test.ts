import { describe, it, expect } from 'vitest'
import util from './index'

describe('csv_transpose', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('csv_transpose')
    expect(util.name).toBe('csv transpose')
    expect(util.category).toBe('Data Formats')
    expect(util.accepts).toBe('string')
    expect(util.produces).toBe('string')
  })

  it('swaps rows and columns', async () => {
    expect(await util.apply('a,b,c\n1,2,3', {})).toBe('a,1\nb,2\nc,3')
    expect(await util.apply('name,age\nAda,36\nGrace,45', {})).toBe('name,Ada,Grace\nage,36,45')
  })

  it('returns empty output for empty input', async () => {
    expect(await util.apply('', {})).toBe('')
    expect(await util.apply('  \n ', {})).toBe('')
  })

  it('pads ragged rows with empty cells', async () => {
    expect(await util.apply('a,b,c\n1,2', {})).toBe('a,1\nb,2\nc,')
  })

  it('turns a single column into a single row', async () => {
    expect(await util.apply('a\nb\nc', {})).toBe('a,b,c')
  })

  it('honours an explicit delimiter and delimiter names', async () => {
    expect(await util.apply('a\tb\n1\t2', { delimiter: '\\t' })).toBe('a\t1\nb\t2')
    expect(await util.apply('a;b\n1;2', { delimiter: ';' })).toBe('a;1\nb;2')
    expect(await util.apply('a|b\n1|2', { delimiter: 'pipe' })).toBe('a|1\nb|2')
    expect(await util.apply('a\tb\n1\t2', { delimiter: 'auto' })).toBe('a\t1\nb\t2')
  })

  it('re-quotes fields that need it and unwraps those that do not', async () => {
    expect(await util.apply('"x,y",b\n1,2', {})).toBe('"x,y",1\nb,2')
    expect(await util.apply('"line1\nline2",b\n1,2', {})).toBe('"line1\nline2",1\nb,2')
  })

  it('preserves non-ASCII and astral characters', async () => {
    expect(await util.apply('a,b\n👩‍🚀,café', {})).toBe('a,👩‍🚀\nb,café')
  })

  it('is its own inverse for rectangular data', async () => {
    const original = 'name,age,city\nAda,36,London\nGrace,45,New York'
    const once = String(await util.apply(original, {}))
    expect(await util.apply(once, {})).toBe(original)
  })

  it('preserves crlf line endings', async () => {
    expect(await util.apply('a,b\r\n1,2', {})).toBe('a,1\r\nb,2')
  })

  it('does not mistake a crlf inside a quoted field for the row separator', async () => {
    expect(await util.apply('a,b\n"x\r\ny",2', {})).toBe('a,"x\r\ny"\nb,2')
  })

  it('keeps a quoted empty cell distinguishable from a blank line', async () => {
    expect(await util.apply('a\n""\nz', {})).toBe('a,"",z')
    expect(await util.apply('a\n\nz', {})).toBe('a,z')
    // and transposing the result restores the original single column
    expect(await util.apply('a,"",z', {})).toBe('a\n""\nz')
  })

  it('throws on an unterminated quoted field', () => {
    expect(() => util.apply('a,b\n"oops,2', {})).toThrow(/unterminated quoted field/)
  })
})
