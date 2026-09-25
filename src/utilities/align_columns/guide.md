---
title: Align Columns Online — Format Text Into Aligned Tables
description: Free online column aligner. Pad whitespace, CSV, or custom-delimited text into neat aligned tables, like the Unix column -t command, with worked examples.
---
## What does aligning columns do?

Plain text organized into rows and columns — a whitespace-separated list, a CSV export, a log file — only looks like a table if every column starts in the same place. This tool measures each column's widest value and pads every cell out to that width, the same job the Unix `column -t` command does. It splits each line on a delimiter and pads the resulting cells; it does not parse quoted CSV fields or escape sequences inside them.

## How it works

1. The input delimiter decides how each line is split into cells. The default, `auto`, splits on runs of one or more whitespace characters, so ragged spacing collapses to a single gap. Any other value is used as a literal separator after backslash escapes are interpreted, so `\t` means a tab (for TSV) and `\\` a literal backslash. Cells are trimmed of surrounding whitespace.
2. For every column, the tool finds the widest cell, counting display width rather than character count: combining marks and zero-width format characters count as 0 columns, and wide CJK characters (Hangul, kana, ideographs, full-width forms) and emoji in the U+1F300–U+1F9FF range count as 2.
3. Each cell is padded with spaces up to that column's width, then all the cells in a row are joined with the output delimiter (two spaces by default).
4. Trailing padding at the end of each row is trimmed, so no line ends in invisible whitespace.

```example
title: whitespace-delimited columns
input: name age
Alice 30
Bob 7
output: name   age
Alice  30
Bob    7
```

With an explicit delimiter and a custom output separator, the same logic works on CSV or TSV data. Setting `header` adds a rule of dashes under the first row, sized to match each column:

```example
title: CSV with a header rule and custom separator
params: {"delimiter": ",", "outputDelimiter": " | ", "header": true}
input: name,qty
apple,3
output: name  | qty
----- | ---
apple | 3
```

### Auto alignment

`align: auto` right-aligns a column only when every value in it (excluding the header row) looks like a number, so a mixed table of labels and quantities lines up the quantities on their right edge while the text stays left-aligned:

```example
title: numbers align right, text stays left
params: {"align": "auto"}
input: apples 10
kiwi 3
output: apples  10
kiwi     3
```

Empty input passes straight through:

```example
title: empty input returns unchanged
input:
output:
```

## Options

- **input delimiter** (`delimiter`, default `auto`) — `auto` splits on whitespace runs (spaces and tabs alike); anything else is used literally once `\t`, `\r`, `\n` and `\\` escapes are interpreted. An empty string throws, since there would be nothing to split on.
- **output delimiter** (`outputDelimiter`, default two spaces) — the text placed between padded columns. Supports the same backslash escapes as the input delimiter.
- **align** (`align`, default `left`) — `left` pads on the right, `right` pads on the left, and `auto` decides per column based on whether its data is numeric.
- **header** (`header`, default `false`) — treats the first row as a header and inserts a `-`-filled rule under it, and excludes that row from the `auto` alignment vote so a text label cannot force its own column left.

## Common uses

- Turning `ls -l`-style or log output copied from a terminal into something readable.
- Previewing a CSV or TSV export as a table before importing it elsewhere — see [CSV to Markdown](/util/csv_to_markdown/) or [Markdown table format](/util/markdown_table_format/) for a formatted destination.
- Lining up key-value pairs, environment variable dumps, or any whitespace-separated report.

## Tips and pitfalls

- This is whole-table alignment, not single-value padding — use [pad](/util/pad/) when you only need to pad one string to a fixed width.
- With the `auto` delimiter a tab is just whitespace and splits cells. With any other delimiter, a tab inside a cell is measured as one column rather than expanded to a tab stop; run [tabs ↔ spaces](/util/tabs_spaces/) first if that matters.
- Blank lines stay blank, and the line-ending style (CRLF, LF or CR) and any trailing newline are kept. Mixed endings are normalized: if the input contains any CRLF, every output line ends in CRLF.
- With `header` on, the `auto` alignment vote looks only at a column's data rows, so a numeric column stays right-aligned under a text heading. With `header` off, the first row votes too, and a text label keeps its column left-aligned.
