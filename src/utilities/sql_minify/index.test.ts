import { describe, it, expect } from 'vitest'
import util from './index'

describe('sql_minify', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('sql_minify')
    expect(util.name).toBe('sql minify')
    expect(util.category).toBe('Formatting')
    expect(util.accepts).toBe('string')
    expect(util.produces).toBe('string')
    expect(Object.keys(util.params).sort()).toEqual(['removeComments', 'semicolonNewline'])
  })

  it('declares the params from the spec, with defaults', () => {
    expect(util.params.removeComments).toMatchObject({ kind: 'boolean', default: true })
    expect(util.params.semicolonNewline).toMatchObject({ kind: 'boolean', default: false })
  })

  it('applies the declared defaults when no params are passed', async () => {
    const sql = 'select 1 /* c */ ; select 2;'
    expect(await util.apply(sql, {})).toBe(
      await util.apply(sql, { removeComments: true, semicolonNewline: false })
    )
  })

  it('collapses a formatted query onto one line', async () => {
    const sql = [
      'SELECT',
      '  id,   -- primary key',
      '  name',
      'FROM users',
      'WHERE id = 1;'
    ].join('\n')
    expect(await util.apply(sql, {})).toBe('SELECT id, name FROM users WHERE id = 1;')
  })

  it('returns empty string for empty and whitespace-only input', async () => {
    expect(await util.apply('', {})).toBe('')
    expect(await util.apply('  \n\t \r\n ', {})).toBe('')
  })

  it('strips block comments by default and keeps them when asked', async () => {
    expect(await util.apply('select /* hi */ a from t', {})).toBe('select a from t')
    expect(await util.apply('select /* hi */ a from t', { removeComments: false })).toBe(
      'select /* hi */ a from t'
    )
  })

  it('keeps line comments on their own line when removeComments is false', async () => {
    expect(await util.apply('select 1 -- note\nfrom t', { removeComments: false })).toBe(
      'select 1 -- note\nfrom t'
    )
    expect(await util.apply('select 1 -- note\nfrom t', { removeComments: true })).toBe(
      'select 1 from t'
    )
  })

  it('never touches comment markers inside string literals', async () => {
    expect(await util.apply("select 'a -- b' , '/* c */' from t", {})).toBe(
      "select 'a -- b', '/* c */' from t"
    )
    expect(await util.apply("select 'it''s   here'   from t", {})).toBe(
      "select 'it''s   here' from t"
    )
    expect(await util.apply('select "an -- id",   `a /* b */ c`   from t', {})).toBe(
      'select "an -- id", `a /* b */ c` from t'
    )
  })

  it('preserves postgres dollar-quoted bodies verbatim', async () => {
    expect(await util.apply('do $$ begin -- hi\n end $$;', {})).toBe('do $$ begin -- hi\n end $$;')
    // `$1` is a bind parameter, not the start of a dollar quote.
    expect(await util.apply('select   *  from t where a = $1', {})).toBe(
      'select * from t where a = $1'
    )
  })

  it('tightens spacing around commas and parentheses', async () => {
    expect(await util.apply('insert into t ( a , b ) values ( 1 , 2 )', {})).toBe(
      'insert into t (a, b) values (1, 2)'
    )
  })

  it('honours semicolonNewline in both positions', async () => {
    expect(await util.apply('select 1; select 2;', { semicolonNewline: false })).toBe(
      'select 1; select 2;'
    )
    expect(await util.apply('select 1;\n\nselect 2;', { semicolonNewline: true })).toBe(
      'select 1;\nselect 2;'
    )
  })

  it('preserves non-ascii literals including astral characters', async () => {
    expect(await util.apply("select 'héllo 😀'   as café\n from t", {})).toBe(
      "select 'héllo 😀' as café from t"
    )
    expect(String(await util.apply("select 'a😀b' from t", {}))).toContain('😀')
  })

  it('leaves a T-SQL bracket identifier intact', async () => {
    expect(await util.apply('select [my -- col]\nfrom [dbo].[t]', {})).toBe(
      'select [my -- col] from [dbo].[t]'
    )
    // `]]` is an escaped `]`, so this is one identifier and its spaces must stay.
    expect(await util.apply('select [a]]   b] ,  c from t', {})).toBe(
      'select [a]]   b], c from t'
    )
  })

  it('honours both flags at once', async () => {
    expect(
      await util.apply('select 1 /*a*/; -- b\nselect 2;', {
        removeComments: true,
        semicolonNewline: true
      })
    ).toBe('select 1;\nselect 2;')
    expect(
      await util.apply('select 1 /*a*/; -- b\nselect 2;', {
        removeComments: false,
        semicolonNewline: true
      })
    ).toBe('select 1 /*a*/;\n-- b\nselect 2;')
  })

  it('is idempotent — minifying its own output changes nothing', async () => {
    const sql = "select a , b /* c */ from t where x = 'y ; z' ; select 2 ;"
    for (const params of [{}, { semicolonNewline: true }, { removeComments: false }]) {
      const once = String(await util.apply(sql, params))
      expect(await util.apply(once, params)).toBe(once)
    }
    expect(await util.apply(sql, {})).toBe("select a, b from t where x = 'y ; z'; select 2;")
  })

  it('throws on unterminated literals and comments', () => {
    expect(() => util.apply("select 'abc", {})).toThrow(/unterminated string literal/)
    expect(() => util.apply('select "abc', {})).toThrow(/unterminated quoted identifier/)
    expect(() => util.apply('select 1 /* nope', {})).toThrow(/unterminated block comment/)
    expect(() => util.apply('do $body$ begin', {})).toThrow(/unterminated dollar-quoted/)
  })

  it('reports the line number of an unterminated literal', () => {
    expect(() => util.apply("select 1\nfrom t\nwhere a = 'x", {})).toThrow(/line 3/)
  })
})
