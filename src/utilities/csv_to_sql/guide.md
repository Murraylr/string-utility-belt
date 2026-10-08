---
title: CSV to SQL INSERT Generator Online
description: Convert CSV rows into SQL INSERT statements for Postgres, MySQL, SQL Server, or SQLite, with an optional CREATE TABLE.
---
## What does converting CSV to SQL do?

Loading a spreadsheet export into a database often means writing `INSERT`
statements by hand, or reaching for a full ETL tool for what is really a
one-off job. This tool reads CSV and emits ready-to-run `INSERT INTO`
statements (one per row, or batched into a single multi-row statement) with
identifiers quoted correctly for the SQL dialect you choose, and can also
emit a best-guess `CREATE TABLE` from the data it sees.

## How it works

1. The delimiter is auto-detected, or set explicitly.
2. The first row is always the header and supplies column names; a blank
   header cell is named after its position (`column_2` for the second
   column), and a missing cell in a short row becomes `NULL`.
3. Each value is classified on its own: integers and decimals (without
   leading zeros) are written unquoted, `true`/`false` in any letter case
   become the dialect's boolean literal (or `1`/`0` for SQLite and SQL
   Server), your chosen **null token** becomes `NULL`, and everything else
   becomes a single-quoted string literal. Embedded single quotes are
   doubled (`O'Brien` → `'O''Brien'`) in every dialect; for MySQL,
   backslashes are doubled too.
4. Identifiers (table and column names) are quoted per dialect (double
   quotes for ANSI/Postgres/SQLite, backticks for MySQL, square brackets for
   SQL Server), and a dotted **table name** like `app.people` is split into
   a schema and table, each quoted separately, while a dot inside a column
   name is kept as part of that one identifier.

```example
title: CSV to postgres INSERT statements
params: {"table": "users", "delimiter": "auto", "dialect": "postgres", "batch": false, "nullToken": "", "createTable": false}
input:
name,email,age
Ada Lovelace,ada@example.com,36
Grace Hopper,grace@example.com,85
output:
INSERT INTO "users" ("name", "email", "age") VALUES ('Ada Lovelace', 'ada@example.com', 36);
INSERT INTO "users" ("name", "email", "age") VALUES ('Grace Hopper', 'grace@example.com', 85);
```

Turning **single multi-row insert** on batches every row into one statement
instead of one `INSERT` per row:

```example
title: batched into a single multi-row insert
params: {"batch": true}
input:
id,name
1,Alice
2,Bob
output:
INSERT INTO "my_table" ("id", "name") VALUES
  (1, 'Alice'),
  (2, 'Bob');
```

Values are typed automatically: a number stays unquoted, a boolean becomes
`TRUE`/`FALSE` in ANSI, and an empty cell becomes `NULL`. A number with a
leading zero, such as the zip-code-like `007`, does not count as a number,
so it is written as the string `'007'`:

```example
title: numbers, booleans, and NULL are inferred automatically
params: {"dialect": "ansi"}
input: n,b,z,s
42,true,,007
output: INSERT INTO "my_table" ("n", "b", "z", "s") VALUES (42, TRUE, NULL, '007');
```

With **emit CREATE TABLE** on, a header-only CSV (no data rows) still
produces a full table definition. Every column defaults to a text type
when there is no data to infer a narrower one from:

```example
title: CREATE TABLE from a header with no data rows
params: {"createTable": true}
input: id,name
output:
CREATE TABLE "my_table" (
  "id" VARCHAR(255),
  "name" VARCHAR(255)
);
```

## Options

- **table name**: the target table, default `my_table`. A dotted name
  (`app.people`) is written as a schema-qualified, separately quoted
  identifier.
- **delimiter**: `auto` (default) detects comma, tab, semicolon, or pipe;
  or set one explicitly.
- **dialect**: `ansi` (default), `mysql`, `postgres`, `mssql`, or
  `sqlite`. Controls identifier quoting, boolean literals, and the inferred
  column types for `CREATE TABLE`.
- **single multi-row insert**: off by default (one `INSERT` per row); on
  writes all rows as one statement with a `VALUES` list. SQL Server accepts
  at most 1,000 rows in one `VALUES` list, so leave this off for larger
  files there.
- **null token**: the CSV value that should become SQL `NULL`. Empty by
  default, so a blank cell means `NULL`; set it to a sentinel like `\N` if
  your export uses one, letting an empty cell become a literal empty string
  instead.
- **emit CREATE TABLE**: off by default. On, prepends a `CREATE TABLE`
  statement with column types inferred from the data (or the dialect's text
  type, when there is none). The text type is `VARCHAR(255)` for ANSI and
  `NVARCHAR(255)` for SQL Server, so widen it if your values are longer.

## Tips and pitfalls

- A blank table name, or one made only of dots, throws an error rather than
  generating an unusable statement.
- `CREATE TABLE` type inference looks at the whole column: a column is only
  typed as an integer, decimal, or boolean if every non-null value in it
  parses that way, otherwise it falls back to text. `INSERT` values, by
  contrast, are classified cell by cell, so a text column holding `123` in
  one row and `abc` in another gets an unquoted `123` and a quoted `'abc'`.
- Quoting a value in the CSV does not make it a string: the CSV quotes are
  removed during parsing, so `"42"` is still written as `42`.
- SQL Server (`mssql`) literals are prefixed with `N` automatically whenever
  the value contains a character outside printable ASCII, so the literal is
  sent as Unicode. The target column still needs an `NVARCHAR` (or
  UTF-8-collated) type to store characters outside its code page.
- Blank lines are not skipped: a blank line in the middle of the CSV
  becomes a row of `NULL`s (with the default empty null token).
- The escaping assumes you picked the dialect of the server you run it on,
  with that server's default settings. Only `mysql` output doubles
  backslashes, so run MySQL-bound SQL with the `mysql` dialect; a MySQL
  server running with `NO_BACKSLASH_ESCAPES` stores the doubled backslashes
  literally, and a PostgreSQL server with `standard_conforming_strings`
  off treats backslashes as escapes, which this output does not account for.
  Review generated SQL before running it against data you do not trust.
- To reshape or filter the source columns first, chain
  [csv select columns](/util/csv_columns/) or
  [csv normalize headers](/util/csv_normalize_headers/) before this step.
  To inspect the same data as JSON instead, use
  [csv to json](/util/csv_to_json/).
