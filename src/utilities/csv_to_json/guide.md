---
title: CSV to JSON Converter Online — Typed Records
description: Convert CSV to JSON arrays of objects online, with delimiter detection, header keys, number and boolean typing, and trimming.
---
## What does converting CSV to JSON do?

CSV is a great format for spreadsheets but an awkward one for code: every
value is text, and there is no standard way to represent nested data. This
tool parses CSV (or TSV, semicolon- or pipe-delimited data) with a full
RFC 4180 reader — quoted fields, embedded newlines, `""` escapes — and turns
each row into a JSON object keyed by the header row, or into a plain array
of arrays if you turn the header off.

## How it works

1. The delimiter is auto-detected, or set explicitly.
2. Rows are parsed, and blank lines (a lone empty, unquoted field) are
   dropped — but a deliberately empty quoted field (`""`) is kept as real
   data.
3. With **first row is header** on (the default), row one supplies the
   object keys. A blank or duplicate header gets a positional fallback name
   (`column_2`) or a `_2` suffix, so no field ever silently overwrites
   another.
4. Fields are trimmed by default, unless a field was written as a quoted
   value — quoting is treated as an explicit "keep this whitespace" signal,
   the same convention [json to csv](/util/json_to_csv/) uses when writing
   fields that need to survive a trimming reader.
5. With **coerce numbers/booleans/null** on, plain-looking values become
   real JSON types; a value with leading zeros, or an integer of 16 or more
   digits that a JavaScript number cannot hold exactly, is left as a string.

```example
title: typed CSV to JSON records
params: {"delimiter": "auto", "header": true, "typed": true, "trim": true, "indent": 2}
input:
name,email,age
Ada Lovelace,ada@example.com,36
Grace Hopper,grace@example.com,85
output:
[
  {
    "name": "Ada Lovelace",
    "email": "ada@example.com",
    "age": 36
  },
  {
    "name": "Grace Hopper",
    "email": "grace@example.com",
    "age": 85
  }
]
```

With **first row is header** off, every row — including the first — becomes
an array of strings instead of an object:

```example
title: no header row produces arrays of arrays
params: {"header": false, "indent": 2}
input:
a,b
1,2
output:
[
  [
    "a",
    "b"
  ],
  [
    "1",
    "2"
  ]
]
```

Typing leaves a leading-zero string and an integer too large for a JS
number as text, so no digits are lost from IDs and zip codes:

```example
title: typed values, without losing leading zeros or precision
params: {"typed": true, "indent": 2}
input:
n,ok,nothing,zip,big
42,true,null,01234,12345678901234567890
output:
[
  {
    "n": 42,
    "ok": true,
    "nothing": null,
    "zip": "01234",
    "big": "12345678901234567890"
  }
]
```

A quoted empty field is different from a blank line: the parser keeps the
first as a genuine empty (or whitespace) value and only drops the second.

```example
title: a quoted empty value is kept, a blank line is dropped
params: {"indent": 2}
input:
a
""
"  "
z
output:
[
  {
    "a": ""
  },
  {
    "a": "  "
  },
  {
    "a": "z"
  }
]
```

## Options

- **delimiter** — `auto` (default) detects comma, tab, semicolon, or pipe;
  or set one explicitly, including delimiter names like `pipe` or an escape
  like `\t`.
- **first row is header** — on (default) produces an array of objects
  keyed by the header row; off produces an array of arrays.
- **coerce numbers/booleans/null** — off by default. On, converts
  `true`/`false`/`null` (in any letter case) and plain decimal numbers to
  real JSON types, while long integers and forms such as `007`, `+5`, `.5`,
  or `1,000` stay text. Quoting a value in the CSV does not stop it being
  coerced — `"42"` still becomes `42`.
- **trim fields** — on by default, trimming whitespace from unquoted
  fields only; quoted fields keep their whitespace exactly as written.
- **indent** — spaces of JSON indentation, from 0 to 16 (default 2); `0`
  produces compact single-line JSON.

## Common uses

- Feeding a CSV export into a script or API that expects JSON.
- Turning a database export into JSON test fixtures.
- Checking a [json to csv](/util/json_to_csv/) export by converting it
  back — flat records round-trip, but flattened `a.b` columns come back as
  literal `"a.b"` keys, not nested objects.

## Tips and pitfalls

- Every record gets the same set of keys, even if some rows are missing
  trailing fields — those keys just get an empty string.
- An unterminated quoted field (a stray `"` with no matching close) throws
  an error rather than silently mangling the rest of the file.
- Typed numbers pass through a JavaScript double, so `1.50` becomes `1.5`,
  `1e3` becomes `1000`, and a decimal with more than about 17 significant
  digits is rounded. Leave typing off if exact decimal text matters.
- To go from JSON back to CSV, including flattening nested objects and
  arrays into `a.b` / `a[0]`-style columns, use
  [json to csv](/util/json_to_csv/). For a quick human-readable view of the
  same table, try [csv to markdown table](/util/csv_to_markdown/) or
  [csv to html table](/util/csv_to_html/) instead.
