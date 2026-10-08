---
title: CSV Column Selector: Keep, Drop, Reorder Fields
description: Select, drop, or reorder CSV columns by name or position online, with worked examples for headers, indexes, and delimiters.
---
## What does selecting CSV columns do?

Real-world CSV exports often carry more columns than you need, or the columns
are not in the order a downstream tool expects. This tool rewrites a CSV
table down to only the columns you list (addressed by header name or by a
1-based position) and puts them in the order you list them. Leaving the
column list empty is a deliberate no-op: a freshly added step passes the
table through unchanged instead of erroring on an empty configuration.

It pairs naturally with other CSV steps: trim a wide export down to the
fields a report needs before piping it into [csv to json](/util/csv_to_json/)
or [csv to markdown table](/util/csv_to_markdown/), or move an id column to
the front without opening a spreadsheet.

## How it works

The tool parses your CSV with an RFC 4180 reader (quoted fields, embedded
newlines, `""` escapes), then:

1. Splits the **columns** option on commas. A quoted name such as
   `"last, first"` keeps its own comma instead of being split.
2. Resolves each entry against the header row: first an exact match, then a
   case-insensitive, trimmed match, and finally, if the entry is a whole
   number, as a 1-based column position. If **first row is a header** is
   off, entries must be 1-based column numbers, since there are no names to
   match.
3. In **keep** mode the output has exactly those columns, in that order. You
   can even repeat a name to duplicate a column. In **drop** mode every
   *other* column survives, in its original order.
4. Rewrites the surviving rows, re-quoting any field that now needs it for
   the chosen delimiter.

```example
title: keep two columns by name, reordered
params: {"columns": "city, name", "mode": "keep"}
input:
name,age,city
Alice,30,Paris
Bob,25,Berlin
output:
city,name
Paris,Alice
Berlin,Bob
```

```example
title: drop a column instead of keeping it
params: {"columns": "age", "mode": "drop"}
input:
name,age,city
Alice,30,Paris
Bob,25,Berlin
output:
name,city
Alice,Paris
Bob,Berlin
```

Column names match case-insensitively, so `columns: "AGE"` still finds an
`age` header. With the header row switched off, you address columns purely
by position, counting from 1 like a spreadsheet:

```example
title: select by 1-based index with no header row
params: {"columns": "3, 1", "header": false}
input:
a,b,c
d,e,f
output:
c,a
f,d
```

## Options

- **columns**: a comma-separated list of names or 1-based positions to
  keep (in **keep** mode) or to exclude (in **drop** mode). Wrap a name in quotes if it contains a
  comma. Leaving this empty returns the table unchanged, which is why a
  freshly dropped-in step never breaks a pipeline.
- **mode**: `keep` (default) outputs only the listed columns, in the order
  listed; `drop` outputs every column except the listed ones, keeping their
  original order.
- **delimiter**: `auto` (default) scores comma, tab, semicolon, and pipe and
  picks the most consistent one; or set an explicit delimiter, including
  `\t` for a literal tab.
- **first row is a header**: on (default) lets you address columns by name;
  off requires 1-based indexes and treats every row, including the first, as
  data.

## Tips and pitfalls

- An unknown column name throws an error instead of silently producing an
  empty column, so a typo in **columns** is easy to catch.
- A column index of 0, a negative number, or one larger than the widest row
  also throws, because indexes always start at 1.
- To rename headers instead of selecting them, use
  [csv normalize headers](/util/csv_normalize_headers/). To reshape the
  filtered table further, chain [csv transpose](/util/csv_transpose/) or
  [csv change delimiter](/util/csv_delimiter/) after this step.
- Rows shorter than the header are padded with empty strings for any
  selected column that is missing from that row.
