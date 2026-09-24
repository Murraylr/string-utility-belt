import { describe, it, expect } from 'vitest'
import util from './index'

const NUL = String.fromCharCode(0)

describe('shell_quote', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('shell_quote')
    expect(util.name).toBe('shell quote')
    expect(util.category).toBe('String Ops')
    expect(util.accepts).toBe('string')
    expect(util.produces).toBe('string')
  })

  it('quotes for posix by default', async () => {
    expect(await util.apply('hello world', {})).toBe("'hello world'")
    expect(await util.apply('rm -rf /tmp/*', {})).toBe("'rm -rf /tmp/*'")
  })

  it('handles embedded single quotes in posix quote mode', async () => {
    expect(await util.apply("it's", { flavor: 'posix', mode: 'quote' })).toBe("'it'\\''s'")
  })

  it('escapes for posix without quoting', async () => {
    expect(await util.apply('hello world', { flavor: 'posix', mode: 'escape' })).toBe('hello\\ world')
    expect(await util.apply('a"b$c', { flavor: 'posix', mode: 'escape' })).toBe('a\\"b\\$c')
  })

  it('quotes newlines rather than backslash-escaping them in posix escape mode', async () => {
    expect(await util.apply('a\nb', { flavor: 'posix', mode: 'escape' })).toBe("a'\n'b")
  })

  it('quotes and escapes for powershell', async () => {
    expect(await util.apply("it's", { flavor: 'powershell', mode: 'quote' })).toBe("'it''s'")
    expect(await util.apply('hello world', { flavor: 'powershell', mode: 'escape' })).toBe('hello` world')
    expect(await util.apply('$env:PATH', { flavor: 'powershell', mode: 'escape' })).toBe('`$env:PATH')
    expect(await util.apply('a\nb', { flavor: 'powershell', mode: 'escape' })).toBe('a`nb')
  })

  // Verified against powershell.exe: an unescaped comma makes PowerShell build an
  // array (`a,b` binds as two arguments), and a leading `-` binds as a parameter
  // name, so both have to be backticked.
  it('escapes the powershell array comma and a leading dash', async () => {
    expect(await util.apply('a,b', { flavor: 'powershell', mode: 'escape' })).toBe('a`,b')
    expect(await util.apply('-Force', { flavor: 'powershell', mode: 'escape' })).toBe('`-Force')
    // a dash that is not leading is an ordinary character
    expect(await util.apply('utf-8', { flavor: 'powershell', mode: 'escape' })).toBe('utf-8')
    // quote mode needs neither, a literal string is never parsed as a parameter
    expect(await util.apply('-Force,now', { flavor: 'powershell', mode: 'quote' })).toBe("'-Force,now'")
  })

  it('quotes for cmd using the CommandLineToArgvW rules', async () => {
    expect(await util.apply('he said "hi"', { flavor: 'cmd', mode: 'quote' })).toBe('"he said \\"hi\\""')
    expect(await util.apply('C:\\path\\', { flavor: 'cmd', mode: 'quote' })).toBe('"C:\\path\\\\"')
  })

  it('escapes cmd metacharacters with a caret', async () => {
    expect(await util.apply('a & b', { flavor: 'cmd', mode: 'escape' })).toBe('a ^& b')
    expect(await util.apply('100%!', { flavor: 'cmd', mode: 'escape' })).toBe('100^%^!')
    expect(await util.apply('a|b<c>d(e)', { flavor: 'cmd', mode: 'escape' })).toBe('a^|b^<c^>d^(e^)')
  })

  // Verified against cmd.exe: `^"` is swallowed by CommandLineToArgvW, `\^"`
  // survives both cmd.exe and the receiving program.
  it('escapes cmd quotes so they survive both parsers', async () => {
    expect(await util.apply('say "hi"', { flavor: 'cmd', mode: 'escape' })).toBe('say \\^"hi\\^"')
    expect(await util.apply('a\\\\"b', { flavor: 'cmd', mode: 'escape' })).toBe('a\\\\\\\\\\^"b')
    // backslashes not followed by a quote are ordinary characters
    expect(await util.apply('C:\\path\\', { flavor: 'cmd', mode: 'escape' })).toBe('C:\\path\\')
  })

  it('preserves astral characters instead of splitting surrogates', async () => {
    expect(await util.apply('caf\u00e9 \u{1F600}', { flavor: 'posix', mode: 'quote' })).toBe("'caf\u00e9 \u{1F600}'")
    expect(await util.apply('caf\u00e9 \u{1F600}', { flavor: 'posix', mode: 'escape' })).toBe('caf\u00e9\\ \u{1F600}')
    expect(await util.apply('\u{1F600}', { flavor: 'powershell', mode: 'escape' })).toBe('\u{1F600}')
  })

  it('returns empty string for empty input in every flavor', async () => {
    expect(await util.apply('', {})).toBe('')
    expect(await util.apply('', { flavor: 'powershell', mode: 'escape' })).toBe('')
    expect(await util.apply('', { flavor: 'cmd', mode: 'quote' })).toBe('')
  })

  it('throws on values a shell cannot carry', async () => {
    expect(() => util.apply(`a${NUL}b`, { flavor: 'posix' })).toThrow(/NUL/)
    expect(() => util.apply(`a${NUL}b`, { flavor: 'powershell', mode: 'escape' })).toThrow(/NUL/)
    expect(() => util.apply('a\nb', { flavor: 'cmd', mode: 'quote' })).toThrow(/line breaks/)
    expect(() => util.apply('a\r\nb', { flavor: 'cmd', mode: 'escape' })).toThrow(/line breaks/)
    // a backticked leading space is dropped by PowerShell, so refuse rather than lie
    expect(() => util.apply(' indented', { flavor: 'powershell', mode: 'escape' })).toThrow(/leading space/)
    expect(await util.apply(' indented', { flavor: 'powershell', mode: 'quote' })).toBe("' indented'")
  })
})
