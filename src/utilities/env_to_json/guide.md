---
title: .env to JSON Converter Online
description: Parse a .env file into JSON online, handling quotes, comments, export prefixes, ${VAR} expansion, and value typing.
---
## What does converting a .env file to JSON do?

A `.env` file holds configuration as `KEY=value` lines, the convention
popularized by the dotenv libraries for loading environment variables in
development. It is
simple to write but awkward to consume from anything other than a shell or
a dotenv library. This tool parses a real `.env` file (including quoting,
comments, `export` prefixes, and variable references) into a plain JSON
object, so you can inspect, diff, or feed the configuration into tools that
expect JSON.

## How it works

1. Blank lines and lines starting with `#` are skipped; a leading `export `
   keyword is stripped before the key is read.
2. A value can be unquoted (trimmed, with an inline `# comment` cut off at
   the first `#` that starts a new word), single-quoted (taken completely
   literally, including any `$`), double-quoted (with backslash escapes
   like `\n`, `\t`, and `\uXXXX` expanded), or backtick-quoted (literal,
   like single quotes). Any of the three quote styles can span multiple
   lines.
3. If a key repeats, the last assignment wins, matching how a shell
   processes repeated exports.
4. With **expand `${VAR}`** on, `$NAME` and `${NAME}` references are
   substituted with values defined anywhere in the same file (before or
   after the reference), with `${NAME:-fallback}` supported; an undefined
   name without a fallback becomes an empty string. The process environment
   is never consulted. Off, references are left as literal text. Either
   way, an escaped `\$` in an unquoted or double-quoted value becomes a
   literal `$`.
5. With **coerce numbers/booleans** on, an unquoted value that looks like a
   number or is exactly `true`, `false`, or `null` becomes that JSON type;
   quoted values are always left as strings, and integers too large to
   survive as a JS number are kept as text so no digits are lost.

```example
title: comments, an export prefix, and a quoted value
input:
PORT=3000
DEBUG=true
# comment
export NAME="Ada Lovelace"
output:
{
  "PORT": "3000",
  "DEBUG": "true",
  "NAME": "Ada Lovelace"
}
```

`${VAR}` references only resolve when **expand `${VAR}`** is turned on:

```example
title: ${VAR} expansion
params: {"expand": true}
input:
HOST=localhost
URL=http://${HOST}:8080/api
output:
{
  "HOST": "localhost",
  "URL": "http://localhost:8080/api"
}
```

With **coerce numbers/booleans** on, plain numeric and boolean values become
real JSON types:

```example
title: typed values
params: {"typed": true}
input:
COUNT=42
ENABLED=true
output:
{
  "COUNT": 42,
  "ENABLED": true
}
```

A double-quoted value can span multiple lines, with the line break kept as
part of the value:

```example
title: a multi-line double-quoted value
input:
KEY="first
second"
NEXT=ok
output:
{
  "KEY": "first\nsecond",
  "NEXT": "ok"
}
```

## Options

- **coerce numbers/booleans**: off by default (every value is a string);
  on, converts unquoted `true`/`false`/`null` and canonical-looking numbers
  to real JSON types. Quoted values are never coerced, since quoting is an
  explicit "keep this as text" signal.
- **expand `${VAR}`**: off by default (values are left exactly as
  written, aside from unescaping `\$`); on, resolves `$NAME` and
  `${NAME}` / `${NAME:-fallback}` references against the other values in
  the same file. Single- and backtick-quoted values are never expanded.
- **indent**: spaces of JSON indentation, from 0 to 10 (default 2).

## Common uses

- Reviewing or diffing the effective configuration a `.env` file would
  produce, including any `${VAR}` substitutions.
- Converting environment configuration into JSON for a config-loading
  library, a test fixture, or a deployment manifest.
- Spotting values that parse differently than you intended, for example
  an unquoted value cut short by a ` #` inline comment.

## Tips and pitfalls

- A circular `${VAR}` reference (two variables that reference each other)
  throws an error rather than looping forever.
- A key such as `__proto__` or `constructor` is treated as ordinary data,
  not as a JavaScript prototype property.
- An unterminated quoted value (a `"` with no matching close before the
  file ends) throws, naming the line where the value started. So does any
  non-comment line without an `=`.
- Keys are copied as-is: an underscore-joined name such as `DB_HOST` stays
  one flat key, not a nested `DB.HOST` object.
- To go the other direction, use [json to .env](/util/json_to_env/); to work
  with a similarly structured INI/config file instead, see
  [ini to json](/util/ini_to_json/).
