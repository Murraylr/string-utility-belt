---
title: Markdown Table to CSV Converter Online
description: Convert a markdown pipe table to CSV online, dropping the alignment row and quoting fields under RFC 4180.
---
## What does converting a markdown table to CSV do?

A markdown pipe table (`| a | b |` with a `|---|---|` row underneath) is
easy to read in a text editor but is not directly usable as data. This tool
finds the table inside a larger document — skipping any surrounding
prose — strips the alignment row, and writes the remaining cells out as
proper RFC 4180 CSV.

## How it works

1. The tool scans line by line and groups consecutive lines that contain an
   unescaped `|` into runs, so a table can sit anywhere inside a longer
   document.
2. If more than one run is found, it prefers the run that contains a real
   alignment row (`---`, `:--`, `--:`, or `:-:`) over an earlier line that
   merely happens to contain a stray pipe, such as `cost | benefit below:`.
3. Within the chosen run, the alignment row is dropped and the line
   directly above it becomes the header; leading and trailing pipes are
   optional either way.
4. A cell is split on unescaped `|`; `\|` becomes a literal pipe and `<br>`
   becomes a real newline. Every cell is then written out with RFC 4180
   quoting.
5. Ragged rows are padded to the width of the widest row so the resulting
   CSV is rectangular.

```example
title: a pipe table with its alignment row
input:
| Name | Age |
| --- | --- |
| Ada | 36 |
| Grace | 85 |
output: Name,Age
Ada,36
Grace,85
```

Outer pipes are optional — a table written without leading and trailing
`|` characters parses the same way:

```example
title: a table without outer pipes
input:
name | age
--- | ---
Alice | 30
output: name,age
Alice,30
```

`\|` inside a cell is unescaped to a literal pipe, and prose above the table
that happens to contain a stray `|` is correctly skipped in favor of the
real table below it:

```example
title: an escaped pipe, and prose with a stray pipe above the table
input:
see a|b below
| h1 | h2 |
| --- | --- |
| x \| y | 2 |
output: h1,h2
x | y,2
```

A row with more or fewer cells than the header widens or pads the whole
table instead of losing data:

```example
title: a ragged row widens the table instead of losing cells
input:
| a | b |
| --- | --- |
| 1 | 2 | 3 |
output: a,b,
1,2,3
```

## Options

- **delimiter** — the CSV field separator to write, default `,`. Accepts an
  escape such as `\t`.

## Common uses

- Turning a table copied from a README or wiki page into data you can open
  in a spreadsheet.
- Extracting a table embedded in a longer markdown document — release
  notes, a changelog, a spec — without hand-copying cells.
- Feeding the result into [csv to json](/util/csv_to_json/) once it is in
  CSV form.

## Tips and pitfalls

- The alignment row is required to recognize prose-adjacent pipes
  correctly; a document with no `|---|` style row at all is still accepted
  as long as at least one contiguous run of pipe-containing lines exists,
  but a document with no pipes anywhere throws an error.
- Only one table is converted: the first block of pipe lines that
  has an alignment row (or, if none has one, the first block).
- To go the other direction — CSV to a padded markdown table — use
  [csv to markdown table](/util/csv_to_markdown/); the two round-trip for
  ordinary rectangular data.
- If your table already looks correct but has uneven column widths, you
  want [markdown table prettify](/util/markdown_table_format/) instead,
  which pads a markdown table in place without converting it to CSV.
