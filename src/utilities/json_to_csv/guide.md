---
title: JSON to CSV Converter Online: Arrays to Table
description: Convert a JSON array of objects to CSV online, with column selection, nested-value flattening, and custom delimiters.
---
## What does converting JSON to CSV do?

An API response or a JSON export is usually an array of objects, but a
spreadsheet, a database import, or a report needs rows and columns. This
tool turns that array into CSV: it collects the union of every object's
keys as columns, writes one row per object, and quotes any value that needs
it under RFC 4180 rules. It also accepts an array of arrays (already a
grid, with row 0 as the header), a single object, or a plain array of
scalars.

## How it works

1. If the input is a JSON array of arrays, it is treated as a ready-made
   grid: row 0 is the header and every other row is data, addressed
   directly with no key matching involved. With **header row** off, row 0
   is dropped rather than written as data.
2. Otherwise, every element becomes one record. A single object becomes one
   row; a bare array of numbers or strings becomes rows of `{ value: ... }`.
3. The **columns** to emit are the union of every record's keys, in the
   order each key first appears, unless you supply a comma-separated
   **columns** list, which both selects and orders them.
4. With **flatten nested** on, an object becomes `a.b` columns and an array
   becomes `a[0]`, `a[1]` columns; off, nested values are written as
   compact JSON text in a single cell.
5. Every cell is quoted under RFC 4180 rules whenever it contains the
   delimiter, a quote, a newline, or leading/trailing whitespace. The
   whitespace case exists so a value like `"  x  "` still round-trips
   through a reader that trims unquoted fields, such as
   [csv to json](/util/csv_to_json/). A row whose only field is empty (an
   empty value in a one-column table) is written as `""`, because a bare
   blank line is skipped by most readers.

```example
title: array of objects with a header row
input: [{"name":"Ada","age":36},{"name":"Grace","age":85}]
output: name,age
Ada,36
Grace,85
```

```example
title: a named delimiter
params: {"delimiter": "tab"}
input: [{"a":1,"b":2}]
output: a	b
1	2
```

Nested objects and arrays are JSON-stringified into a single cell by
default; **flatten nested** spreads them into their own columns instead:

```example
title: flatten nested objects and arrays into columns
params: {"flatten": true}
input: [{"user":{"name":"Ada"},"tags":["x","y"]}]
output: user.name,tags[0],tags[1]
Ada,x,y
```

In a one-column table, an empty value is quoted so the row is not lost:

```example
title: an empty value in a one-column table
input: [{"email":"a@example.com"},{"email":""}]
output:
email
a@example.com
""
```

The **columns** option both filters and reorders the output:

```example
title: pick and reorder columns
params: {"columns": "c, a"}
input: [{"a":1,"b":2,"c":3}]
output: c,a
3,1
```

## Options

- **delimiter**: the field separator, default `,` (also used when the box
  is left empty). Accepts an escape (`\t`) or a name (`tab`, `pipe`,
  `semicolon`); cannot be the quote character.
- **header row**: on by default, writing column names as row one.
- **flatten nested**: off by default, which JSON-stringifies nested
  objects/arrays into one cell; on spreads them into `a.b` / `a[0]`
  columns.
- **line endings**: `lf` (default) or `crlf`.
- **columns (comma list)**: leave empty to use every key in first-seen
  order, or list specific column names (for a record input) or 1-based
  indexes / header names (for a matrix input) to select and reorder them.
  An unknown column name throws rather than producing a blank column.

## Common uses

- Exporting an API's JSON response to a CSV a spreadsheet can open.
- Flattening nested JSON test fixtures into a flat table for review.
- Reordering or trimming columns before generating a report with
  [csv to markdown table](/util/csv_to_markdown/) or
  [csv to html table](/util/csv_to_html/).

## Tips and pitfalls

- `null` and `undefined` become an empty cell; every other scalar is
  stringified directly, so `false` becomes `false` and `0` becomes `0`
  rather than disappearing.
- An empty array `[]` produces no output at all. There is nothing to put a
  header on.
- To reverse this conversion, use [csv to json](/util/csv_to_json/), which
  understands the same RFC 4180 quoting. Flat records of strings come back
  intact, empty values included. Numbers come back as numbers only with that
  utility's typing option on (which also converts number-like strings). `null` comes back as
  an empty string, a missing key as an empty value, and nested data as JSON
  text or flat `a.b` keys.
- Invalid JSON input throws an error naming the parse failure rather than
  producing empty or partial output.
