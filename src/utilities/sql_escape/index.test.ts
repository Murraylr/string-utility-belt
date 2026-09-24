import { describe, it, expect } from 'vitest'
import util from './index'

const NUL = String.fromCharCode(0)

describe('sql_escape', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('sql_escape')
    expect(util.name).toBe('sql escape')
    expect(util.category).toBe('String Ops')
    expect(util.accepts).toBe('string')
    expect(util.produces).toBe('string')
  })

  it('doubles single quotes and wraps by default (ansi)', async () => {
    expect(await util.apply("O'Brien", {})).toBe("'O''Brien'")
    expect(await util.apply('plain', {})).toBe("'plain'")
  })

  it('honours wrap = false', async () => {
    expect(await util.apply("O'Brien", { flavor: 'ansi', wrap: false })).toBe("O''Brien")
    expect(await util.apply("O'Brien", { flavor: 'mssql', wrap: false })).toBe("O''Brien")
  })

  it('uses backslash escapes for mysql', async () => {
    expect(await util.apply("it's\nC:\\tmp", { flavor: 'mysql' })).toBe("'it\\'s\\nC:\\\\tmp'")
    expect(await util.apply('say "hi"', { flavor: 'mysql', wrap: false })).toBe('say \\"hi\\"')
  })

  it('leaves backslashes literal for postgres (standard_conforming_strings)', async () => {
    expect(await util.apply('C:\\tmp', { flavor: 'postgres' })).toBe("'C:\\tmp'")
    expect(await util.apply("it's", { flavor: 'postgres' })).toBe("'it''s'")
  })

  it('adds the N prefix for non-ascii mssql literals only', async () => {
    expect(await util.apply('caf\u00e9', { flavor: 'mssql' })).toBe("N'caf\u00e9'")
    expect(await util.apply('cafe', { flavor: 'mssql' })).toBe("'cafe'")
  })

  it('preserves astral characters', async () => {
    expect(await util.apply('\u{1F600}', { flavor: 'mysql' })).toBe("'\u{1F600}'")
    expect(await util.apply('\u{1F600}', { flavor: 'mssql' })).toBe("N'\u{1F600}'")
  })

  it('returns empty string for empty input', async () => {
    expect(await util.apply('', {})).toBe('')
    expect(await util.apply('', { flavor: 'mysql' })).toBe('')
  })

  it('escapes NUL for mysql but rejects it elsewhere', async () => {
    expect(await util.apply(`a${NUL}b`, { flavor: 'mysql', wrap: false })).toBe('a\\0b')
    expect(() => util.apply(`a${NUL}b`, { flavor: 'ansi' })).toThrow(/NUL/)
    expect(() => util.apply(`a${NUL}b`, { flavor: 'postgres' })).toThrow(/NUL/)
    expect(() => util.apply(`a${NUL}b`, { flavor: 'mssql' })).toThrow(/NUL/)
  })
})
