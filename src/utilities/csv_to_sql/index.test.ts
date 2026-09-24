import { describe, it, expect } from 'vitest'
import util from './index'

const CSV = 'id,name\n1,Alice\n2,Bob'

describe('csv_to_sql', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('csv_to_sql')
    expect(util.name).toBe('csv to sql insert')
    expect(util.category).toBe('Data Formats')
    expect(util.accepts).toBe('string')
    expect(util.produces).toBe('string')
    expect(Object.keys(util.params).sort()).toEqual([
      'batch', 'createTable', 'delimiter', 'dialect', 'nullToken', 'table'
    ])
  })

  it('emits one insert per row by default', async () => {
    expect(await util.apply(CSV, {})).toBe(
      'INSERT INTO "my_table" ("id", "name") VALUES (1, \'Alice\');\n' +
      'INSERT INTO "my_table" ("id", "name") VALUES (2, \'Bob\');'
    )
  })

  it('returns empty string for empty input', async () => {
    expect(await util.apply('', {})).toBe('')
    expect(await util.apply('  \n ', {})).toBe('')
    // header only, nothing to insert
    expect(await util.apply('id,name', {})).toBe('')
  })

  it('honours the table param, including schema-qualified names', async () => {
    expect(await util.apply(CSV, { table: 'people' })).toContain('INSERT INTO "people" ("id", "name")')
    expect(await util.apply(CSV, { table: 'app.people' })).toContain('INSERT INTO "app"."people"')
    expect(await util.apply(CSV, { table: 'a"b' })).toContain('INSERT INTO "a""b"')
    expect(await util.apply(CSV, { table: 'a]b', dialect: 'mssql' })).toContain('INSERT INTO [a]]b]')
  })

  it('keeps a dotted column name as ONE identifier', async () => {
    // `user.name` is a column called `user.name`, not `name` in table `user`
    expect(await util.apply('user.name,id\nada,1', {})).toBe(
      'INSERT INTO "my_table" ("user.name", "id") VALUES (\'ada\', 1);'
    )
    expect(await util.apply('user.name\nada', { createTable: true })).toContain('"user.name" VARCHAR(255)')
    expect(await util.apply('a.b\n1', { dialect: 'mysql' })).toContain('(`a.b`)')
  })

  it('quotes identifiers and literals per dialect', async () => {
    expect(await util.apply(CSV, { dialect: 'ansi' })).toContain('INSERT INTO "my_table" ("id", "name")')
    expect(await util.apply(CSV, { dialect: 'postgres' })).toContain('INSERT INTO "my_table" ("id", "name")')
    expect(await util.apply(CSV, { dialect: 'sqlite' })).toContain('INSERT INTO "my_table" ("id", "name")')
    expect(await util.apply(CSV, { dialect: 'mysql' })).toContain('INSERT INTO `my_table` (`id`, `name`)')
    expect(await util.apply(CSV, { dialect: 'mssql' })).toContain('INSERT INTO [my_table] ([id], [name])')
  })

  it('escapes quotes and backslashes in string literals', async () => {
    expect(await util.apply("name\nO'Brien", { dialect: 'ansi' })).toContain("VALUES ('O''Brien');")
    expect(await util.apply('path\nC:\\tmp', { dialect: 'mysql' })).toContain("VALUES ('C:\\\\tmp');")
    expect(await util.apply('name\nO"Neil', { dialect: 'ansi' })).toContain('VALUES (\'O"Neil\');')
  })

  it('types numbers, booleans and the null token', async () => {
    const out = await util.apply('n,b,z,s\n42,true,,007', { dialect: 'ansi' })
    expect(out).toBe('INSERT INTO "my_table" ("n", "b", "z", "s") VALUES (42, TRUE, NULL, \'007\');')
    expect(await util.apply('b\nfalse', { dialect: 'sqlite' })).toContain('VALUES (0);')
    expect(await util.apply('b\ntrue', { dialect: 'mssql' })).toContain('VALUES (1);')
    expect(await util.apply('n\n-3.5e2', {})).toContain('VALUES (-3.5e2);')
  })

  it('honours the nullToken param', async () => {
    expect(await util.apply('a,b\n1,\\N', { nullToken: '\\N' })).toContain('VALUES (1, NULL);')
    // with a non-empty token an empty cell is a real empty string
    expect(await util.apply('a,b\n1,', { nullToken: 'NULL' })).toContain("VALUES (1, '');")
  })

  it('batches rows into a single statement when batch is on, one each when off', async () => {
    expect(await util.apply(CSV, { batch: true })).toBe(
      'INSERT INTO "my_table" ("id", "name") VALUES\n  (1, \'Alice\'),\n  (2, \'Bob\');'
    )
    expect(await util.apply(CSV, { batch: false })).toBe(
      'INSERT INTO "my_table" ("id", "name") VALUES (1, \'Alice\');\n' +
      'INSERT INTO "my_table" ("id", "name") VALUES (2, \'Bob\');'
    )
  })

  it('emits an inferred CREATE TABLE when createTable is on', async () => {
    const out = await util.apply('id,score,flag,name\n1,1.5,true,Ada\n2,2.5,false,Bob', {
      createTable: true,
      dialect: 'postgres'
    })
    expect(out.toString().startsWith(
      'CREATE TABLE "my_table" (\n  "id" INTEGER,\n  "score" NUMERIC,\n  "flag" BOOLEAN,\n  "name" TEXT\n);'
    )).toBe(true)
    expect(out).toContain('INSERT INTO "my_table"')
    expect(await util.apply('id\n1', { createTable: true, dialect: 'mssql' })).toContain('[id] INT')
    expect(await util.apply('id\nx', { createTable: true, dialect: 'ansi' })).toContain('"id" VARCHAR(255)')
    expect(await util.apply(CSV, { createTable: false })).not.toContain('CREATE TABLE')
    // a header with no data rows still describes the table
    expect(await util.apply('id,name', { createTable: true })).toBe(
      'CREATE TABLE "my_table" (\n  "id" VARCHAR(255),\n  "name" VARCHAR(255)\n);'
    )
  })

  it('auto-detects the delimiter and accepts an explicit one', async () => {
    expect(await util.apply('id;name\n1;Alice', {})).toContain('("id", "name") VALUES (1, \'Alice\')')
    expect(await util.apply('id\tname\n1\tAlice', {})).toContain('("id", "name") VALUES (1, \'Alice\')')
    expect(await util.apply('id|name\n1|Alice', { delimiter: '|' })).toContain('("id", "name")')
    expect(await util.apply('id\tname\n1\tAlice', { delimiter: '\\t' })).toContain('("id", "name")')
    // a backslash-escaped literal delimiter is unescaped, not used verbatim
    expect(await util.apply('id|name\n1|Alice', { delimiter: '\\|' })).toContain('("id", "name")')
  })

  it('handles unicode, and prefixes mssql literals with N', async () => {
    expect(await util.apply('city\nZürich \u{1F600}', { dialect: 'ansi' })).toContain("VALUES ('Zürich \u{1F600}');")
    expect(await util.apply('city\nZürich', { dialect: 'mssql' })).toContain("VALUES (N'Zürich');")
    expect(await util.apply('city\nParis', { dialect: 'mssql' })).toContain("VALUES ('Paris');")
  })

  it('names unnamed columns and pads short rows', async () => {
    expect(await util.apply('a,,c\n1,2', {})).toBe(
      'INSERT INTO "my_table" ("a", "column_2", "c") VALUES (1, 2, NULL);'
    )
  })

  it('throws on a blank table name and on malformed csv', () => {
    expect(() => util.apply(CSV, { table: '  ' })).toThrow(/table name is required/)
    // a name made only of dots has no identifier in it either
    expect(() => util.apply(CSV, { table: '.' })).toThrow(/table name is required/)
    expect(() => util.apply('a,b\n"oops,1', {})).toThrow(/unterminated quoted field/)
  })

  it('drops empty segments from a qualified table name', async () => {
    expect(await util.apply(CSV, { table: 'app.' })).toContain('INSERT INTO "app" (')
    expect(await util.apply(CSV, { table: ' app . people ' })).toContain('INSERT INTO "app"."people" (')
  })
})
