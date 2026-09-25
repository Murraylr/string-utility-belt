---
title: INI to JSON Converter Online
description: Parse INI or config file text into JSON online, with dotted section nesting and typed numbers, booleans, and null.
---
## What is INI, and what does converting it to JSON do?

INI is the config-file format of `key=value` lines grouped under
`[section]` headers, used by everything from Windows `.ini` files to
`git config`, PHP's `php.ini`, and countless small config formats that grew
their own dialect over time. There is no single INI standard, so this tool
follows the common conventions: `;` and `#` start a comment, values can be
quoted, and a section header groups the keys that follow it until the next
one. It parses that text into a plain JSON object.

## How it works

1. Lines are read one at a time. `[section]` opens a new section — every
   `key=value` line after it is nested under that section until the next
   header. Keys before the first `[section]` become top-level properties.
2. A `;` or `#` starts a comment only when it opens the line or is preceded
   by whitespace, so a value like `color=#ff8800` is not mistaken for a
   comment. A quote inside a bare value (`don't stop`) does not open a
   quoted region either, so a real comment after it is still recognized.
3. A value wrapped in matching `"` or `'` is unquoted; inside double quotes,
   `\n`, `\t`, and similar escapes are expanded.
4. Repeating the same key collects every value into an array; a key written
   with a trailing `[]` is always forced into an array, even with one value.
5. With **nest dotted names** on, a dotted section (`[db.primary]`) or key
   (`c.d = 1`) becomes real nested objects instead of one literal key.
6. With **coerce value types** on, `true`/`yes`/`on` and `false`/`no`/`off`
   (in any letter case) become booleans, `null`/`nil` becomes `null`, and
   number-like values become JSON numbers — anything else, including a
   quoted value, stays text.

```example
title: top-level values and a section
input:
app=belt

[server]
host=localhost
port=8080
debug=true
output:
{
  "app": "belt",
  "server": {
    "host": "localhost",
    "port": "8080",
    "debug": "true"
  }
}
```

With **coerce value types** on, recognizable values become real JSON types
instead of strings:

```example
title: typed values
params: {"typed": true}
input:
app=belt

[server]
port=8080
enabled=yes
output:
{
  "app": "belt",
  "server": {
    "port": 8080,
    "enabled": true
  }
}
```

**nest dotted names** turns a dotted section header into real nested
objects instead of one section literally named `db.primary`:

```example
title: dotted section names become nested objects
params: {"nested": true}
input: [db.primary]
host=localhost
output:
{
  "db": {
    "primary": {
      "host": "localhost"
    }
  }
}
```

Repeating the same key collects every value into an array, in the order
they appeared:

```example
title: a repeated key collects into an array
input: t=a
t=b
t=c
output:
{
  "t": [
    "a",
    "b",
    "c"
  ]
}
```

## Options

- **nest dotted names** — off by default (a dotted section or key becomes
  one literal name, `"db.primary"`); on, splits on `.` and nests real
  objects, `{ "db": { "primary": { ... } } }`.
- **coerce value types** — off by default (every value is a string); on,
  converts recognizable booleans (`true`/`yes`/`on`, `false`/`no`/`off`),
  `null`/`nil`, and number-like values to real JSON types. Number parsing is
  lenient — `007`, `+5`, and `.5` become `7`, `5`, and `0.5` — so quote a
  value such as a zip code to keep its leading zero; integers beyond 2^53
  stay text. Quoted values are never coerced.
- **indent** — spaces of JSON indentation, from 0 to 10 (default 2).

## Common uses

- Reading an application's `.ini` or `.conf` file into JSON for validation,
  diffing, or programmatic editing.
- Migrating a legacy INI-based configuration to a JSON-based config loader.
- Seeing a config file's structure at a glance — which keys sit in which
  section, and which keys repeat.

## Tips and pitfalls

- A key and a section cannot share a path — writing `a=1` and later
  `[a]` throws a "conflicting key" error rather than silently discarding
  one of them.
- Keys named `__proto__`, `toString`, or `constructor` are treated as
  ordinary data, not as JavaScript object internals.
- An unterminated `[section` header, or a line that is neither a
  `key=value` pair nor a section header, throws a descriptive error naming
  the line number. Only `=` separates a key from its value, so dialects
  that allow `key: value` (Python's `configparser`) or a bare key with no
  value (git config) are rejected, and backslash line continuations are not
  supported.
- To go the other direction, use [json to ini](/util/json_to_ini/); for a
  similarly line-oriented format without sections, see
  [.env to json](/util/env_to_json/).
