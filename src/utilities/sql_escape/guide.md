---
title: SQL Escape Online: Escape Quotes for SQL Literals
description: Escape text for a SQL string literal using ANSI/PostgreSQL quote doubling, MySQL backslash escapes, or T-SQL with an N'' Unicode prefix.
---
## What does escaping for SQL mean?

A SQL string literal is delimited by single quotes, so a literal `'` inside your text has to be escaped somehow or it will end the string early. That is the classic setup behind SQL injection when it is done automatically on untrusted input. This tool escapes text for direct use inside a SQL literal according to one of four **flavors**: `ansi` (the SQL standard, also what PostgreSQL uses by default), `postgres` (an explicit alias for the same rules), `mysql` (MySQL's traditional backslash-escaping), and `mssql` (T-SQL, which also needs an `N` prefix for Unicode text).

## How it works

By default (`ansi`/`postgres`), a single quote is escaped by doubling it, and the result is wrapped in quotes:

```example
title: ansi quote doubling
params: {"flavor": "ansi", "wrap": true}
input: O'Brien
output: 'O''Brien'
```

MySQL instead escapes with backslashes, and covers more characters than just the quote: backslash itself, double quotes, newlines, carriage returns, NUL and Ctrl-Z all get an escape, matching what `mysql_real_escape_string()` has always done:

```example
title: mysql backslash escapes
params: {"flavor": "mysql", "wrap": true}
input: O'Brien
output: 'O\'Brien'
```

The `ansi`/`postgres` flavor leaves backslashes completely alone, which matters if your text contains Windows-style paths or regular-expression-looking strings. With `standard_conforming_strings` on (PostgreSQL's default since version 9.1), a backslash in an ordinary `'...'` literal is just a literal backslash, not an escape character. On a server with that setting turned off, or inside a PostgreSQL `E'...'` string, backslashes are escapes again and this output is not safe.

### The T-SQL Unicode prefix

Without an `N` prefix, SQL Server treats a string literal as `varchar` in the current database's default code page, so characters outside that code page are replaced (typically with `?`); the `N` prefix makes it an `nvarchar` (UTF-16) literal instead. This tool adds that prefix automatically, but only when the text actually contains non-ASCII characters. Plain ASCII text is left with an ordinary literal.

```example
title: mssql adds the N prefix only for non-ASCII text
params: {"flavor": "mssql", "wrap": true}
input: café
output: N'café'
```

### Escaping without the surrounding quotes

Turn **wrap in quotes** off to get just the escaped body, useful when you are inserting the result into a larger literal or template that already supplies the quotes.

```example
title: wrap off returns just the escaped body
params: {"flavor": "ansi", "wrap": false}
input: O'Brien
output: O''Brien
```

## Options

- **flavor**: `ansi` (default, and equivalent to `postgres`), `mysql`, `postgres` or `mssql`.
- **wrap in quotes**: on by default, which surrounds the escaped text with `'...'` (or `N'...'` for non-ASCII `mssql` text). Turn it off to get only the escaped body.

## Common uses

- Building a one-off SQL statement by hand for a quick migration script or manual query, where a query builder or parameterized statement is not already in use.
- Understanding exactly how a given database flavor escapes quotes, backslashes and control characters, for debugging or teaching.
- Preparing literal values for embedding into generated SQL in tools or scripts that target multiple database engines.
- Escaping non-ASCII text correctly for SQL Server, where the `N` prefix is easy to forget and silently corrupts Unicode data if it is missing.

## Tips and pitfalls

- **This tool is not a substitute for parameterized queries.** Escaping quotes correctly prevents a literal from breaking out of its string early, but building SQL by concatenating escaped strings is still fragile and error-prone at scale. Always prefer parameterized queries or prepared statements in real applications, and reserve manual escaping for scripts, debugging, or generated SQL where parameters are not an option.
- A `NUL` (U+0000) character is escaped as `\0` in the `mysql` flavor; the other flavors refuse input containing one rather than embed it raw (PostgreSQL text cannot store `NUL` at all).
- The `mysql` flavor's backslash escaping and the other three flavors' quote doubling are genuinely different rules, and using the wrong one is itself an injection risk. `ansi` output sent to MySQL breaks on backslashes: `a\` becomes `'a\'`, and MySQL reads `\'` as an escaped quote, so the literal never ends. `mysql` output sent to PostgreSQL or SQL Server breaks on quotes, since `\'` there is a backslash followed by the closing quote. MySQL's `NO_BACKSLASH_ESCAPES` SQL mode makes backslash an ordinary character, so use `ansi` for a server running in that mode.
- Escaping only protects values inside a quoted string literal. It does nothing for identifiers (table or column names), numbers, `ORDER BY` fragments or `LIKE` patterns: `%` and `_` pass through unescaped and still act as wildcards.
- Empty input gives empty output, not `''`, even with wrap on, so supply the empty literal yourself when a value can be blank.
- For quoting values in a shell command rather than a SQL statement, see [shell quote](/util/shell_quote/) instead. The two problems look similar but have completely different rules.
