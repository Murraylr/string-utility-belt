---
title: JSON to INI Converter Online
description: Serialize a JSON object as INI text online, turning nested objects into dotted sections and arrays into key[] lines.
---
## What does converting JSON to INI do?

INI-style config files group `key=value` pairs under `[section]` headers,
which is a natural fit for a JSON object one or two levels deep but has no
built-in idea of arrays or types the way JSON does. This tool serializes a
JSON object into that format: scalar properties become `key=value` lines
written before any sections, nested objects become `[section]` blocks
(with dots for deeper nesting), and arrays become repeated `key[]=` lines
so the shape survives being read back.

## How it works

1. Only a JSON object at the root is accepted; the input can be raw JSON
   text or an object handed over from a previous pipeline step.
2. At each level, scalar and array properties are written as lines first,
   and nested objects are written afterward as `[section]` blocks. This
   keeps top-level settings readable above the sections that follow.
3. A nested object's nested object becomes a dotted section name
   (`[a.b]`), so arbitrarily deep structures stay representable.
4. An array is written as one `key[]=value` line per element (even a
   single-element array), so [ini to json](/util/ini_to_json/) reads it
   back as an array rather than a plain scalar. An object or array inside
   an array is written as compact JSON text, which reads back as a string.
5. A value is quoted only when it needs to be: when it has
   leading/trailing whitespace, contains a newline, starts with a quote or
   with `;` or `#`, contains a whitespace-preceded `;` or `#` that a reader
   would take for a comment, or contains the chosen **delimiter**. Quoted
   values escape backslashes, double quotes, and line breaks.

```example
title: top-level values, then a nested section
input-encoding: json
input: {"app":"belt","debug":false,"server":{"host":"localhost","port":8080}}
output: app=belt
debug=false

[server]
host=localhost
port=8080
```

Arrays become one `key[]=` line per element, which keeps even a
single-element array distinguishable from a plain value:

```example
title: arrays become repeated key[] lines
input-encoding: json
input: {"tags":["a","b"],"one":["x"]}
output: tags[]=a
tags[]=b
one[]=x
```

A value is quoted only when INI syntax would otherwise misread it. Here, that is an
embedded newline:

```example
title: a value is quoted only when it needs to be
input-encoding: json
input: {"a":"two\nlines"}
output: a="two\nlines"
```

Deeper nesting produces a dotted section path, one section per level:

```example
title: deep nesting becomes dotted section names
input-encoding: json
input: {"a":{"b":{"c":"d"}}}
output: [a]

[a.b]
c=d
```

## Options

- **delimiter**: the character between key and value, default `=`. A key
  that itself contains the chosen delimiter throws an error rather than
  producing an ambiguous line. [ini to json](/util/ini_to_json/) only
  splits on `=`, so it cannot read back a file written with another
  delimiter.
- **spacing**: off by default (`key=value`); on, adds spaces around the
  delimiter (`key = value`).

## Common uses

- Generating an `.ini` or `.conf` file from a JSON settings object for
  legacy tools that only read INI.
- Producing config output for applications (many desktop and Windows tools,
  some PHP and Python projects) that expect INI over JSON or YAML.
- Round-tripping through [ini to json](/util/ini_to_json/), with
  **nest dotted names** and **coerce value types** turned on there, to
  check whether a JSON structure survives being written and re-read as INI
  (see the caveats below).

## Tips and pitfalls

- A key name that would itself be read back as a section header (one
  starting with `[`) is rejected, since it would silently change the
  document's structure. A key starting with `;` or `#` is not rejected,
  though, and reads back as a comment.
- Strings are not quoted just because they look like other types: `"42"`,
  `"true"`, and `"007"` are written bare, so reading the file back with
  coerce value types on turns them into `42`, `true`, and `7`.
- Keys containing a dot are written unchanged, so reading the file back
  with nest dotted names on splits `"a.b"` into nested objects.
- The root object's scalar values always come before any sections, matching
  how most hand-written INI files put global settings above the sections
  that refine them.
- Input that is not an object at the top level (an array, a string, a
  number) is rejected, since INI has no way to represent a bare top-level
  value.
- For a flatter, section-free config format, see
  [json to .env](/util/json_to_env/) instead.
