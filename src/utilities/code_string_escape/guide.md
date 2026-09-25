---
title: Code String Escape — Escape Text for 10 Languages
description: Escape text as a string literal for JavaScript, Python, Java, C, Go, C#, PHP, Ruby, SQL or JSON, with quote style options.
---
## What does escaping a string literal mean?

Every programming language has its own rules for writing a string as source code: which characters need a backslash escape, how control characters and non-ASCII text are represented, and what a quote character inside the string has to become so it doesn't end the literal early. This tool takes plain text and produces the escaped body — and optionally the fully quoted literal — for the language and quote style you pick, so you can paste a value straight into source code without hand-escaping it or guessing at a language's quirks.

## How it works

Pick a **language**, a **quote style**, and whether to **wrap in quotes**. The tool then walks the text and escapes whatever that language and quote character require: the quote character itself, backslashes, newlines and tabs, other control characters, and — if you ask for it — anything outside ASCII.

```example
title: JavaScript, quoted
params: {"language": "javascript", "wrap": true}
input:
She said "hi"
new line
output: "She said \"hi\"\nnew line"
```

```example
title: Python, single-quoted
params: {"language": "python", "quote": "single", "wrap": true}
input: path\to\file
output: 'path\\to\\file'
```

### SQL has no backslash escapes

Standard SQL string literals don't use backslash escapes — a literal quote character is represented by doubling it. This tool follows that rule instead of inserting backslashes when the language is `sql`:

```example
title: SQL doubles the delimiter instead of using backslashes
params: {"language": "sql", "quote": "single", "wrap": true}
input: it's
output: 'it''s'
```

Backslashes are left untouched. That is right for PostgreSQL (with its default `standard_conforming_strings`), SQL Server, SQLite and Oracle, but MySQL and MariaDB treat a backslash as an escape character by default, so there `'C:\tmp'` would turn `\t` into a tab — double the backslashes yourself for those databases.

### Escaping non-ASCII characters

With **escape non-ascii** turned on, every character outside ASCII is written as that language's Unicode escape instead of passed through as a literal UTF-8 character — `\uXXXX` / `\UXXXXXXXX` for Python, `\u{...}` for PHP and Ruby, and so on:

```example
title: escaping non-ASCII per language
params: {"language": "python", "escapeNonAscii": true}
input: café 😀
output: caf\u00e9 \U0001f600
```

## Options

- **language** — `javascript` (default), `json`, `c`, `java`, `python`, `go`, `csharp`, `php`, `ruby`, or `sql`.
- **quote style** — `double` (default), `single`, or `backtick`. `backtick` is accepted only for JavaScript (template literals), Go (raw strings) and SQL (MySQL-style backtick quoting, which delimits identifiers rather than strings); asking for it with any other language throws an error telling you so.
- **wrap in quotes** — off by default, returning just the escaped body; on to get the full literal including its delimiters.
- **escape non-ascii** — off by default (non-ASCII characters are passed through as literal UTF-8); on to force a Unicode escape for anything outside ASCII.

### Per-language quirks this tool applies

| language / quote | what's different |
| --- | --- |
| `json` | always double-quoted regardless of the quote style param; parses back to exactly the input, like `JSON.stringify` output (DEL, U+007F, is escaped as well) |
| `c` | control bytes use fixed 3-digit octal (`\000`) because C's `\x` escape is greedy and would swallow following hex digits |
| `csharp` | control bytes use `\uXXXX` for the same reason |
| `go`, backtick quote | a raw string literal — no escaping at all; it throws if the text contains a backtick or a carriage return, since neither can be represented |
| `php` / `ruby`, single quote | only `\\` and `\'` mean anything — everything else, including newlines, is left literal |
| `sql` | no backslash escapes; the delimiter character is doubled instead |
| `ruby`, double quote | `#{`, `#$` and `#@` are guarded with `\#` so string interpolation can't fire |
| `javascript`, backtick quote | `${` is guarded with `\$` for the same reason |

## Common uses

- Pasting a dynamic value (a file path, a user string, an error message) into source code as a literal without introducing a syntax error.
- Preparing test fixtures or example code snippets in documentation for a specific language.
- Converting a value between languages when porting code, since each language's escaping is handled correctly rather than assuming JavaScript's rules apply everywhere.
- Safely embedding a string with a mix of quotes, backslashes, and Unicode into a query, script, or generated source file.

## Tips and pitfalls

- The output does not include quotes unless you turn on **wrap in quotes** — remember to add them yourself otherwise.
- To reverse this, use [code string unescape](/util/code_string_unescape/), which decodes escape sequences back to plain text for the same set of languages and understands surrounding quotes automatically.
- If your target is specifically a JSON document rather than a general string literal, [JSON escape](/util/json_escape/) is a lighter-weight option that always applies JSON's fixed rules.
- Empty input always returns an empty string, even when **wrap in quotes** is on — there's nothing to wrap.
- Escaping is not a defence against SQL injection. For queries built from untrusted input, pass values as bound parameters instead of pasting escaped literals into the SQL.
