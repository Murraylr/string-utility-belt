---
title: CSV Transpose Tool: Swap Rows and Columns
description: Flip CSV rows into columns and columns into rows online, re-quoting fields as needed and keeping line endings and non-ASCII text.
---
## What does transposing a CSV do?

Transposing swaps a table's rows and columns: what used to read across now
reads down, and vice versa. It is the same operation as a spreadsheet's
"paste transposed," useful when a table was exported sideways (one record
per column instead of per row), or when you want to compare a handful of
fields across many records by putting the fields down the left edge.

## How it works

1. The delimiter is auto-detected, or set explicitly.
2. The CSV is parsed with an RFC 4180 reader: quoted fields, `""` escapes,
   and embedded newlines or delimiters inside quotes are all preserved.
3. Column *i* of the input becomes row *i* of the output, and vice versa.
   Rows shorter than the widest row are padded with empty cells first, so
   the result is always rectangular.
4. Fields are re-quoted only where needed: a value containing the
   delimiter, a double quote, or a line break is quoted; quotes that were
   never needed are dropped; and a quoted blank value keeps its quotes.

```example
title: swap a small grid
input: a,b,c
1,2,3
output: a,1
b,2
c,3
```

A single column becomes a single row, and a ragged row is padded with an
empty cell before being flipped:

```example
title: ragged rows are padded before transposing
input:
a,b,c
1,2
output:
a,1
b,2
c,
```

For rectangular data the transform is its own inverse: running it again on
the output below gives back the original table.

```example
title: a three-column table flipped (run it again to flip back)
input:
name,age,city
Ada,36,London
Grace,45,New York
output:
name,Ada,Grace
age,36,45
city,London,New York
```

A quoted empty field is different from a blank line, and the distinction
survives the flip in both directions:

```example
title: a quoted empty cell stays distinguishable from a blank line
input:
a
""
z
output: a,"",z
```

## Options

- **delimiter**: `auto` (default) detects comma, tab, semicolon, or pipe;
  or set one explicitly, including delimiter names like `pipe` or an escape
  like `\t`.

## Common uses

- Fixing a spreadsheet export where fields ended up running across columns
  instead of down rows.
- Comparing the same few fields across many records by laying the field
  names down the left edge instead of across the top.
- Feeding transposed data into [csv to json](/util/csv_to_json/) or
  [csv to markdown table](/util/csv_to_markdown/) when the desired record
  shape only exists after flipping the table.

## Tips and pitfalls

- Transposing a non-rectangular table pads it to rectangular first, which
  means running the transform twice on ragged input will not exactly
  restore the original. The padding cells stay padding cells.
- CRLF line endings are preserved: the output uses whichever style (LF or
  CRLF) the source used outside quoted fields.
- To re-delimit the result afterward, chain
  [csv change delimiter](/util/csv_delimiter/); to pick specific columns
  (or, applied after transposing, specific original rows), use
  [csv select columns](/util/csv_columns/).
