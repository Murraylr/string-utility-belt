---
title: Markdown Table Formatter — Align Pipe Tables
description: Pad and align every markdown pipe table in a document so the pipes line up, with alignment overrides and a compact mode.
---
## What does formatting a markdown table do?

A markdown pipe table renders correctly however its cells are spaced, but a
table with uneven column widths is hard to read as raw source — which
matters when you are editing it by hand or reviewing a diff. This tool pads
every cell in every table it finds so the pipes line up, while leaving
everything else in the document — prose, code fences, block quotes, list
items — exactly as it was.

## How it works

1. The document is scanned line by line. A header line followed by a valid
   alignment row (`---`, `:--`, `--:`, `:-:`, one per column) starts a
   table; the body continues until a blank line, a change in block-quote
   depth, or a row with no pipe at all.
2. Content inside fenced code blocks, opened with three or more backticks
   or tildes, is left untouched — a table shown as a code sample is not reformatted.
3. Each column is padded to the width of its widest cell, measured in
   display columns: combining marks and zero-width characters count as 0,
   and East Asian wide characters and the common emoji blocks count as 2.
   This is an approximation of how a monospace editor draws text — emoji
   sequences (joined families, flags) and some older symbol characters can
   still be off by a column or two.
4. **column alignment** either preserves each column's existing alignment
   marker or overrides every column to the same one; the delimiter row is
   rewritten to match.
5. A table with no opening pipe on its lines is never given leading spaces
   during formatting, even under right or center alignment — four leading
   spaces would otherwise turn the whole table into an indented code block.
6. Indentation and block-quote markers (`> `) before a table are preserved
   exactly, so tables inside list items and block quotes stay inside them.

```example
title: pad a compact table so its pipes line up
input:
| a | bb |
|---|---|
| 1 | 2 |
output:
| a   | bb  |
| --- | --- |
| 1   | 2   |
```

Column widths adapt to the longest cell in each column, and each column's
own alignment marker (left, center, right) is preserved by default:

```example
title: mixed alignment markers are preserved by default
input:
| Name | Qty | Price |
|---|:-:|--:|
| Apple | 3 | 1.50 |
| Banana bread | 12 | 22.00 |
output:
| Name         | Qty | Price |
| ------------ | :-: | ----: |
| Apple        |  3  |  1.50 |
| Banana bread | 12  | 22.00 |
```

**compact** removes padding entirely instead of adding it, for the tightest
possible source representation:

```example
title: compact mode strips padding instead of adding it
params: {"compact": true}
input:
| Name  | Qty |
| :---  | --: |
| Apple | 3   |
output:
|Name|Qty|
|:--|--:|
|Apple|3|
```

Column width is measured in display columns, not string length, so wide
characters such as emoji still line up correctly:

```example
title: emoji and wide characters measure as two columns each
input:
| key | value |
| --- | --- |
| 😀😀 | ok |
output:
| key  | value |
| ---- | ----- |
| 😀😀 | ok    |
```

## Options

- **column alignment** — `preserve` (default) keeps each column's own
  marker from the source; `left`, `center`, or `right` overrides every
  column in the document to that alignment.
- **compact (no padding)** — off by default (cells are padded for
  readability); on strips padding down to the minimum, useful for
  minimizing diff noise or file size.

## Common uses

- Cleaning up a table after editing a cell's contents, when the surrounding
  cells no longer line up.
- Normalizing tables generated programmatically — for example by
  [csv to markdown table](/util/csv_to_markdown/) — to a consistent
  alignment style across a document.
- Tidying the tables in documentation before committing it; the operation
  is idempotent, so formatting already-formatted output changes nothing.

## Tips and pitfalls

- A table must have a header row followed immediately by a valid alignment
  row of the same width to be recognized; a plain heading followed by `---`
  (a setext-style underline) is not mistaken for a table.
- If the document has no recognizable table at all, the tool throws rather
  than returning the input unchanged, so you know immediately that nothing
  was formatted.
- To convert a markdown table to CSV instead of just tidying its spacing,
  use [markdown table to csv](/util/markdown_to_csv/).
- Escaped pipes (`\|`) inside a cell are respected and never split into a
  new column.
