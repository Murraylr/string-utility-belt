import { describe, it, expect } from 'vitest'
import util from './index'
import escaper from '../code_string_escape'

const NUL = String.fromCharCode(0)
const BEL = String.fromCharCode(7)

describe('code_string_unescape', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('code_string_unescape')
    expect(util.name).toBe('code string unescape')
    expect(util.category).toBe('Decoding')
    expect(util.accepts).toBe('string')
    expect(util.produces).toBe('string')
  })

  it('decodes the common backslash escapes', async () => {
    expect(await util.apply('a\\nb\\tc\\\\d', {})).toBe('a\nb\tc\\d')
    expect(await util.apply('say \\"hi\\"', {})).toBe('say "hi"')
  })

  it('strips surrounding quotes when present', async () => {
    expect(await util.apply('"a\\nb"', {})).toBe('a\nb')
    expect(await util.apply("'it\\'s'", {})).toBe("it's")
    expect(await util.apply('a"b', {})).toBe('a"b')
  })

  it('decodes hex, brace and surrogate-pair unicode escapes', async () => {
    expect(await util.apply('\\x41\\u00e9', {})).toBe('A\u00e9')
    expect(await util.apply('\\u{1F600}', {})).toBe('\u{1F600}')
    expect(await util.apply('\\ud83d\\ude00', {})).toBe('\u{1F600}')
    expect(await util.apply('\\U0001F600', { language: 'python' })).toBe('\u{1F600}')
  })

  it('decodes octal escapes and line continuations', async () => {
    expect(await util.apply('\\101\\0', { language: 'c' })).toBe(`A${NUL}`)
    expect(await util.apply('\\a\\033', { language: 'c' })).toBe(`${BEL}${String.fromCharCode(27)}`)
    expect(await util.apply('a\\\nb', {})).toBe('ab')
  })

  it('applies language-specific rules', async () => {
    expect(await util.apply("'it''s'", { language: 'sql' })).toBe("it's")
    expect(await util.apply("'it\\'s C:\\\\tmp'", { language: 'php' })).toBe('it\'s C:\\tmp')
    expect(await util.apply('`a\\nb`', { language: 'go' })).toBe('a\\nb')
    expect(await util.apply('\\q', { language: 'javascript' })).toBe('q')
    // python and php keep an unknown escape verbatim; ruby, java and c# drop the backslash
    expect(await util.apply('\\q', { language: 'python' })).toBe('\\q')
    expect(await util.apply('\\q', { language: 'php' })).toBe('\\q')
    expect(await util.apply('\\q', { language: 'ruby' })).toBe('q')
  })

  it('decodes the remaining language options', async () => {
    expect(await util.apply('"caf\\u00e9\\tx"', { language: 'java' })).toBe('caf\u00e9\tx')
    expect(await util.apply('"a\\u0000b\\v"', { language: 'csharp' })).toBe(`a${NUL}b${String.fromCharCode(11)}`)
    expect(await util.apply("'it\\'s \\\\ here'", { language: 'ruby' })).toBe("it's \\ here")
    expect(await util.apply('"#{name}\\u{1F600}"', { language: 'ruby' })).toBe('#{name}\u{1F600}')
  })

  it('round-trips with code_string_escape', async () => {
    const sample = 'a\nb\t"c" caf\u00e9 \u{1F600}'
    const js = await escaper.apply(sample, { language: 'javascript', escapeNonAscii: true, wrap: true })
    expect(await util.apply(js, { language: 'javascript' })).toBe(sample)

    const py = await escaper.apply(sample, { language: 'python', escapeNonAscii: true })
    expect(await util.apply(py, { language: 'python' })).toBe(sample)

    expect(await util.apply(JSON.stringify(sample), { language: 'json' })).toBe(sample)

    const ctrl = `x${NUL}${BEL}y`
    const c = await escaper.apply(ctrl, { language: 'c' })
    expect(await util.apply(c, { language: 'c' })).toBe(ctrl)

    const sql = await escaper.apply("it's", { language: 'sql', quote: 'single', wrap: true })
    expect(await util.apply(sql, { language: 'sql' })).toBe("it's")
  })

  it('returns empty string for empty input', async () => {
    expect(await util.apply('', {})).toBe('')
    expect(await util.apply('""', {})).toBe('')
  })

  it('throws on malformed escape sequences', () => {
    expect(() => util.apply('\\uZZZZ', {})).toThrow(/invalid/)
    expect(() => util.apply('a\\', {})).toThrow(/trailing backslash/)
    expect(() => util.apply('\\u{110000}', {})).toThrow(/Unicode range/)
    expect(() => util.apply('\\u{12', {})).toThrow(/unterminated/)
    expect(() => util.apply('\\xZZ', {})).toThrow(/invalid \\x/)
  })

  it('is strict about json escapes', () => {
    expect(() => util.apply('"\\q"', { language: 'json' })).toThrow(/invalid JSON escape/)
    expect(() => util.apply("\\'", { language: 'json' })).toThrow(/invalid JSON escape/)
    expect(() => util.apply('\\u00', { language: 'json' })).toThrow(/invalid/)
  })
})
