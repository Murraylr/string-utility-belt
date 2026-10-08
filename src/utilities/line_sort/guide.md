---
title: Sort Lines Online: Alphabetical, Numeric & Natural Sort
description: Sort lines of text online alphabetically, numerically, naturally, by length, by a column, or randomly, ascending or descending, with duplicates removed.
---
## What does sorting lines do?

This tool reorders the lines of a block of text according to a chosen rule: alphabetical order, numeric value, "natural" order that treats embedded numbers as numbers, line length, a specific column, or a random shuffle. It covers the same ground as Unix `sort` and its common flags (`sort`, `sort -n`, `sort -V`, `shuf`), without leaving your browser, though its comparison rules are its own rather than an exact copy of GNU `sort`.

## How it works

The text is split into lines on `\n` or `\r\n` (a lone `\r` is not treated as a line break), sorted according to `mode`, then optionally reversed for `direction: desc`. The output uses CRLF endings if the input contained any, otherwise LF. A trailing final newline, if present, is preserved rather than being sorted as if it were an empty line.

By default, comparisons ignore letter case and use locale-aware collation (`localeCompare` in the default locale), so accented letters sort next to their base letter:

```example
title: alphabetical sort is case-insensitive by default
input: Banana
apple
Cherry
output: apple
Banana
Cherry
```

`natural` mode compares embedded runs of digits as numbers rather than character by character, so `v2` correctly sorts before `v10` instead of after it:

```example
title: natural sort keeps v2 before v10
params: {"mode": "natural"}
input: v10
v2
v1
output: v1
v2
v10
```

`numeric` mode reads the leading number off each line and compares those values; lines with no leading number sort after every numeric line:

```example
title: numeric sort compares values, not text
params: {"mode": "numeric"}
input: 10
9
100
2
output: 2
9
10
100
```

`column` mode splits each line into fields (on whitespace by default, or on a custom `separator`) and sorts by the chosen 1-based field. When both fields start with a number and those numbers differ, they are compared numerically; otherwise the fields are compared as text, then the whole lines:

```example
title: sort by the second whitespace-separated field
params: {"mode": "column", "column": 2}
input: alice 30
bob 25
carol 40
output: bob 25
alice 30
carol 40
```

Turning on **remove duplicates** drops every repeat of a line after its first occurrence, case-insensitively unless `caseSensitive` is also set:

```example
title: unique removes repeated lines
params: {"unique": true}
input: b
a
b
a
output: a
b
```

Empty input sorts to empty output:

```example
title: empty input
input:
output:
```

## Options

- **mode** (`mode`, default `alphabetical`): `alphabetical`, `numeric`, `natural`, `length` (code points, not UTF-16 units, so an emoji such as 😀 counts as one character), `column`, or `random`.
- **direction** (`direction`, default `asc`): `asc` or `desc`. `desc` reverses the whole sorted list, so in `numeric` mode lines without a number come first. Ignored by `random`, which has no direction to reverse.
- **case sensitive** (`caseSensitive`, default `false`): affects every text comparison and what counts as a duplicate under `unique`. When on, `alphabetical` compares raw character codes instead of using locale collation, so all uppercase letters sort before lowercase ones and accented letters sort after `z`.
- **remove duplicates** (`unique`, default `false`): drops repeated lines before sorting, keeping the first occurrence's exact text.
- **column** (`column`, default `1`): the 1-based field number used by `column` mode.
- **column separator** (`separator`, default blank = whitespace runs): how `column` mode splits each line into fields. Any other value is matched literally (no `\t` escape).
- **random seed** (`seed`, default `0`): `0` shuffles unpredictably on every run; any other whole number produces a reproducible shuffle of the same input.

## Common uses

- Alphabetizing a list of names, tags, or file paths.
- Sorting version strings, log timestamps embedded in text, or numbered filenames in the order a human expects rather than plain text order.
- Sorting tabular or CSV-like text by a particular column without opening a spreadsheet.
- Producing a repeatable random ordering of a list, such as shuffling quiz questions with a fixed seed.

## Tips and pitfalls

- `numeric` and `column` modes read only the leading number of a line or field; the text after it only breaks ties between equal numbers. In `numeric` mode a line with no leading number is pushed to the end. Thousands separators are not understood, so `1,000` is read as `1`.
- `length` counts Unicode code points rather than the raw UTF-16 length, so most accented letters and simple emoji count as one character each. Flags, emoji with skin tones or ZWJ sequences, and letters built with separate combining accents count as several.
- To remove duplicates without also reordering the lines, use [deduplicate lines](/util/line_dedupe/) instead, which preserves the original order.
- For a genuinely unpredictable shuffle rather than a sort, set `mode` to `random` and leave `seed` at `0`; set a non-zero seed only when you need the same shuffle again later.
