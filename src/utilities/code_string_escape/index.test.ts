import { describe, it, expect } from 'vitest'
import util from './index'

const NUL = String.fromCharCode(0)
const BEL = String.fromCharCode(7)
const VT = String.fromCharCode(11)
const ESC = String.fromCharCode(27)

describe('code_string_escape', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('code_string_escape')
    expect(util.name).toBe('code string escape')
    expect(util.category).toBe('Encoding')
    expect(util.accepts).toBe('string')
    expect(util.produces).toBe('string')
  })

  it('escapes a javascript double-quoted literal by default', async () => {
    expect(await util.apply('line1\nline2\t"q"\\', {})).toBe('line1\\nline2\\t\\"q\\"\\\\')
    expect(await util.apply("it's", {})).toBe("it's")
  })

  it('wraps in the chosen quote style', async () => {
    expect(await util.apply('hi', { wrap: true })).toBe('"hi"')
    expect(await util.apply("it's", { quote: 'single', wrap: true })).toBe("'it\\'s'")
  })

  it('guards template-literal interpolation for backtick javascript', async () => {
    expect(await util.apply('`${x}`', { language: 'javascript', quote: 'backtick', wrap: true }))
      .toBe('`\\`\\${x}\\``')
    expect(await util.apply('cost: $5', { language: 'javascript', quote: 'backtick' })).toBe('cost: $5')
  })

  it('matches JSON.stringify for the json language', async () => {
    const sample = 'a\nb\t"c"\\d caf\u00e9 \u{1F600}' + NUL
    expect(await util.apply(sample, { language: 'json', wrap: true })).toBe(JSON.stringify(sample))
    // json is always double quoted, whatever the quote param says
    expect(await util.apply('"x"', { language: 'json', quote: 'single', wrap: true })).toBe('"\\"x\\""')
  })

  it('escapes non-ascii per language when asked', async () => {
    expect(await util.apply('caf\u00e9 \u{1F600}', { language: 'javascript', escapeNonAscii: true }))
      .toBe('caf\\u00e9 \\ud83d\\ude00')
    expect(await util.apply('caf\u00e9 \u{1F600}', { language: 'python', escapeNonAscii: true }))
      .toBe('caf\\u00e9 \\U0001f600')
    expect(await util.apply('caf\u00e9', { language: 'php', escapeNonAscii: true })).toBe('caf\\u{e9}')
  })

  it('keeps astral characters intact when not escaping non-ascii', async () => {
    expect(await util.apply('\u{1F600}', {})).toBe('\u{1F600}')
    expect(await util.apply('\u{1F600}', { language: 'c' })).toBe('\u{1F600}')
  })

  it('uses the right control-character escape per language', async () => {
    expect(await util.apply(NUL + BEL + ESC, { language: 'c' })).toBe('\\000\\a\\033')
    expect(await util.apply(NUL + VT, { language: 'java' })).toBe('\\u0000\\u000b')
    expect(await util.apply(NUL + VT, { language: 'csharp' })).toBe('\\u0000\\v')
    expect(await util.apply(NUL + BEL, { language: 'python' })).toBe('\\x00\\a')
    expect(await util.apply(NUL, { language: 'javascript' })).toBe('\\x00')
  })

  it('handles go raw strings via the backtick quote', async () => {
    expect(await util.apply('a\nb', { language: 'go', quote: 'backtick' })).toBe('a\nb')
    expect(await util.apply('a\nb', { language: 'go', quote: 'backtick', wrap: true })).toBe('`a\nb`')
    expect(await util.apply('a\tb', { language: 'go' })).toBe('a\\tb')
  })

  it('applies php and ruby interpolation and single-quote rules', async () => {
    expect(await util.apply('$var "x"', { language: 'php' })).toBe('\\$var \\"x\\"')
    expect(await util.apply("it's C:\\tmp", { language: 'php', quote: 'single' })).toBe("it\\'s C:\\\\tmp")
    expect(await util.apply('#{name} #tag', { language: 'ruby' })).toBe('\\#{name} #tag')
    expect(await util.apply("it's a \\ one", { language: 'ruby', quote: 'single' })).toBe("it\\'s a \\\\ one")
  })

  it('doubles the delimiter for sql instead of using backslashes', async () => {
    expect(await util.apply("it's C:\\tmp", { language: 'sql', quote: 'single' })).toBe("it''s C:\\tmp")
    expect(await util.apply("it's", { language: 'sql', quote: 'single', wrap: true })).toBe("'it''s'")
    expect(await util.apply('say "hi"', { language: 'sql', quote: 'double' })).toBe('say ""hi""')
  })

  it('returns empty string for empty input', async () => {
    expect(await util.apply('', {})).toBe('')
    expect(await util.apply('', { language: 'go', quote: 'backtick' })).toBe('')
  })

  it('throws for impossible literal shapes', () => {
    expect(() => util.apply('x', { language: 'python', quote: 'backtick' })).toThrow(/backtick/)
    expect(() => util.apply('a`b', { language: 'go', quote: 'backtick' })).toThrow(/backtick/)
    expect(() => util.apply('a\r\nb', { language: 'go', quote: 'backtick' })).toThrow(/carriage return/)
  })
})
