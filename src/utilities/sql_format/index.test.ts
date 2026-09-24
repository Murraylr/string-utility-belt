import { describe, it, expect } from 'vitest'
import util, { DIALECTS, KEYWORD_CASES } from './index'

describe('sql_format', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('sql_format')
    expect(util.name).toBe('sql format')
    expect(util.category).toBe('Formatting')
    expect(util.accepts).toBe('string')
    expect(util.produces).toBe('string')
    expect(Object.keys(util.params).sort()).toEqual([
      'dialect',
      'indent',
      'keywordCase',
      'linesBetweenQueries'
    ])
  })

  it('declares the params from the spec, with defaults', () => {
    expect(util.params.dialect).toMatchObject({
      kind: 'select',
      options: ['sql', 'mysql', 'postgresql', 'sqlite', 'mariadb', 'bigquery', 'spark', 'transactsql'],
      default: 'sql'
    })
    expect(util.params.keywordCase).toMatchObject({
      kind: 'select',
      options: ['upper', 'lower', 'preserve'],
      default: 'upper'
    })
    expect(util.params.indent).toMatchObject({ kind: 'number', default: 2 })
    expect(util.params.linesBetweenQueries).toMatchObject({ kind: 'number', default: 1 })
  })

  it('applies the declared defaults when no params are passed', async () => {
    const sql = 'select id from users; select 2;'
    expect(await util.apply(sql, {})).toBe(
      await util.apply(sql, {
        dialect: 'sql',
        keywordCase: 'upper',
        indent: 2,
        linesBetweenQueries: 1
      })
    )
    // …and the default really is one blank line between statements.
    expect(await util.apply(sql, {})).toBe('SELECT\n  id\nFROM\n  users;\n\nSELECT\n  2;')
  })

  it('formats a realistic query with the defaults', async () => {
    expect(await util.apply('select id, name from users where id = 1', {})).toBe(
      'SELECT\n  id,\n  name\nFROM\n  users\nWHERE\n  id = 1'
    )
  })

  it('returns empty string for empty and whitespace-only input', async () => {
    expect(await util.apply('', {})).toBe('')
    expect(await util.apply('   \n\t  ', {})).toBe('')
  })

  it('honours every keywordCase option', async () => {
    expect(await util.apply('SELECT id FROM users', { keywordCase: 'lower' })).toBe(
      'select\n  id\nfrom\n  users'
    )
    expect(await util.apply('SeLeCt id FroM users', { keywordCase: 'preserve' })).toBe(
      'SeLeCt\n  id\nFroM\n  users'
    )
    expect(await util.apply('select id from users', { keywordCase: 'upper' })).toBe(
      'SELECT\n  id\nFROM\n  users'
    )
    expect(KEYWORD_CASES).toEqual(['upper', 'lower', 'preserve'])
  })

  it('honours the indent width', async () => {
    expect(await util.apply('select id, name from users', { indent: 4 })).toBe(
      'SELECT\n    id,\n    name\nFROM\n    users'
    )
    expect(await util.apply('select id, name from users', { indent: 0 })).toBe(
      'SELECT\nid,\nname\nFROM\nusers'
    )
  })

  it('clamps a negative indent instead of throwing', async () => {
    // sql-formatter passes tabWidth to String.repeat, which throws on negatives.
    expect(await util.apply('select id from users', { indent: -4 })).toBe(
      'SELECT\nid\nFROM\nusers'
    )
  })

  it('honours linesBetweenQueries', async () => {
    expect(await util.apply('select 1; select 2;', { linesBetweenQueries: 0 })).toBe(
      'SELECT\n  1;\nSELECT\n  2;'
    )
    expect(await util.apply('select 1; select 2;', { linesBetweenQueries: 3 })).toBe(
      'SELECT\n  1;\n\n\n\nSELECT\n  2;'
    )
  })

  it('accepts every declared dialect', async () => {
    for (const dialect of DIALECTS) {
      const out = String(await util.apply('select a from t where b = 1', { dialect }))
      expect(out).toBe('SELECT\n  a\nFROM\n  t\nWHERE\n  b = 1')
    }
    expect(DIALECTS).toHaveLength(8)
  })

  it('uses dialect-specific syntax rules', async () => {
    expect(await util.apply('select top 1 [name] from [dbo].[users]', { dialect: 'transactsql' }))
      .toBe('SELECT\n  TOP 1 [name]\nFROM\n  [dbo].[users]')
    expect(await util.apply('select a::text from t', { dialect: 'postgresql' })).toBe(
      'SELECT\n  a::text\nFROM\n  t'
    )
    expect(await util.apply('select `a` from `t`', { dialect: 'mysql' })).toBe(
      'SELECT\n  `a`\nFROM\n  `t`'
    )
  })

  it('preserves non-ascii literals including astral characters', async () => {
    expect(await util.apply("select 'héllo 😀 café' as greeting", {})).toBe(
      "SELECT\n  'héllo 😀 café' AS greeting"
    )
  })

  it('falls back to defaults for unknown param values', async () => {
    expect(await util.apply('select id from users', { dialect: 'oracle', keywordCase: 'shout' }))
      .toBe('SELECT\n  id\nFROM\n  users')
  })

  it('throws a clear error on unparseable SQL', async () => {
    await expect(util.apply("select 'abc", {})).rejects.toThrow(/could not format SQL/)
    await expect(util.apply('@@@ !!!', {})).rejects.toThrow(/could not format SQL/)
    await expect(util.apply('select `a` from t', { dialect: 'postgresql' })).rejects.toThrow(
      /could not format SQL \(postgresql\)/
    )
  })
})
