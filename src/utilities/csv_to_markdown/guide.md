---
title: CSV to Markdown Table Converter Online
description: Turn CSV data into a padded markdown pipe table online, with left, right, center, or no column alignment.
---
## What does converting CSV to a markdown table do?

Markdown pipe tables — the `| a | b |` syntax used by GitHub, GitLab, and
most static-site generators — are easy to write by hand for a couple of
rows, but tedious to align once the values vary in length. This tool parses
CSV and writes it back out as a markdown table with every column padded to
the same width, so the pipes line up and the raw text is as readable as the
rendered version.

## How it works

1. The delimiter is auto-detected, or set explicitly.
2. CSV is parsed with an RFC 4180 reader, so quoted fields, `""` escapes,
   and fields containing the delimiter are all handled correctly.
3. Every column is padded to the width of its longest cell (at least three
   characters), measured in Unicode code points so an astral character such
   as a single emoji counts as one, not two UTF-16 units. Wide CJK
   characters and multi-code-point emoji can still look misaligned in a
   monospace editor, though the table renders the same either way.
4. A pipe inside a cell is escaped as `\|`, and an embedded newline becomes
   `<br>`, since a literal line break would otherwise break the table
   structure.
5. With **first row is a header** off, an all-blank header row is still
   emitted, because a markdown table is not valid without one.

```example
title: CSV to a left-aligned markdown table
params: {"delimiter": "auto", "align": "left", "header": true}
input:
name,email,age
Ada Lovelace,ada@example.com,36
Grace Hopper,grace@example.com,85
output:
| name         | email             | age |
| :----------- | :---------------- | :-- |
| Ada Lovelace | ada@example.com   | 36  |
| Grace Hopper | grace@example.com | 85  |
```

**align** controls both the delimiter row's markers and which side gets the
padding:

```example
title: right-aligned columns
params: {"align": "right"}
input:
name,age
Alice,30
Bob,7
output:
|  name | age |
| ----: | --: |
| Alice |  30 |
|   Bob |   7 |
```

With no header row, the table still needs one line to satisfy markdown's
table syntax, so a blank header is emitted and your data starts on the
first body row:

```example
title: no header row still needs a blank header line
params: {"header": false}
input:
a,b
1,2
output:
|     |     |
| :-- | :-- |
| a   | b   |
| 1   | 2   |
```

A literal pipe in a cell must be escaped so it is not read as a column
separator when the table is rendered:

```example
title: an escaped pipe in a cell
params: {"delimiter": ","}
input: a|b,"x
y"
output:
| a\|b | x<br>y |
| :--- | :----- |
```

## Options

- **delimiter** — `auto` (default) detects comma, tab, semicolon, or pipe;
  or set one explicitly, including `\t` for tab.
- **align** — `left` (default), `center`, `right`, or `none` (a plain
  `---` separator with no explicit alignment).
- **first row is a header** — on (default) uses row one as the header; off
  emits a blank header row and treats every row as data.

## Common uses

- Turning a CSV export into a table you can paste straight into a README,
  GitHub issue, or wiki page.
- Sharing a small dataset in a pull request description without attaching a
  spreadsheet.
- Producing readable, aligned tables for documentation generated from data
  files.

## Tips and pitfalls

- To go the other direction, use
  [markdown table to csv](/util/markdown_to_csv/) — the two are inverses for
  ordinary rectangular data.
- The output is a pure markdown table with no surrounding prose; add any
  heading or caption yourself.
- If you would rather have real `<table>` markup, use
  [csv to html table](/util/csv_to_html/) instead.
- Ragged rows (fewer cells than the widest row) are padded with empty cells,
  so a short row never breaks the table's column count.
