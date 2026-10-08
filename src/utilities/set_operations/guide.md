---
title: Line Set Operations Online: Union, Intersect, Diff Lists
description: Compare two lists of lines with union, intersection, difference, or symmetric difference online, with case-insensitive and sorted output options.
---
## What are set operations on lines?

Set operations treat each line of text as one member of a set, then compare two sets the way you would
in math class: which lines appear in both lists, which appear in only one, or which appear in either but
not both. This is useful whenever you have two lists (usernames, IP addresses, file names, feature
flags) and need to know how they relate, without writing a script or opening a spreadsheet.

The tool takes your input as the first list and a second list you paste or upload as the **other list**
parameter, then applies one of four operations:

- **union**: every line that appears in either list, with duplicates removed.
- **intersection** (the default): only lines that appear in both lists.
- **difference**: lines that are in your input but not in the other list.
- **symmetric difference**: lines that are in exactly one of the two lists, not both.

## How it works

Both lists are split into lines (`\n` or `\r\n`), empty lines are dropped so a trailing newline never
becomes a phantom member, and (by default) each line is trimmed of leading/trailing whitespace. The result
keeps the original casing and the order the lines first appeared in, never contains a duplicate line, and
is joined with `\n`.

Take an input of `a`, `b`, `c` and an other list of `b`, `c`, `d`. The default operation, intersection,
keeps only the lines common to both:

```example
title: intersection keeps lines common to both lists
params: {"other": "b\nc\nd"}
input:
a
b
c
output:
b
c
```

Switching to union combines both lists and removes duplicates, keeping first-seen order; adding
**sort result** puts the output in order instead:

```example
title: union with the result sorted
params: {"other": "b\nc\nd", "operation": "union", "sort": true}
input:
a
b
c
output:
a
b
c
d
```

Difference keeps only what is unique to your input:

```example
title: difference (only in the input)
params: {"other": "b\nd", "operation": "difference"}
input:
a
b
c
output:
a
c
```

Duplicate lines never survive into the result, whichever operation you pick. A line that appears twice
in your input still counts as one member, and empty lines are always ignored (whitespace-only lines too,
while **trim lines** is on) so a trailing newline from copy-paste never becomes a phantom member of either
list:

```example
title: a repeated line collapses to one match
params: {"other": "a"}
input:
a
a
b
output:
a
```

Turning on **ignore case** matches lines regardless of case but keeps the casing from your input in the
output:

```example
title: ignore case matches "Apple" against "apple"
params: {"other": "apple", "ignoreCase": true}
input:
Apple
Banana
output: Apple
```

## Options

- **other list**: the second list of lines to compare against, one item per line. It can be pasted or
  loaded from a file.
- **operation**: `union`, `intersection` (default), `difference`, or `symmetric-difference`, as described
  above.
- **ignore case**: off by default. When on, `Apple` and `apple` are treated as the same member, and the
  version from your input is kept in the result.
- **trim lines**: on by default, so `  a  ` and `a` are the same member. Turn it off to compare lines
  byte-for-byte, whitespace included.
- **sort result**: off by default, which keeps the order lines first appeared in. Turn it on to sort the
  result by character code (so with **ignore case** off, `Zebra` sorts before `apple`); with **ignore
  case** on, the sort compares lowercased lines.

## Common uses

- Finding which entries were added or removed between two versions of a config file, allow-list, or CSV
  export (compare with [text diff](/util/text_diff/) when you also want to see line-level edits).
- Cross-referencing two exported lists (subscribers vs. customers, active users vs. all users) to find
  overlaps or gaps.
- Merging two word lists or tag lists into one deduplicated set with union (chain another union step to
  add a third list). Use [count duplicate lines](/util/uniq_count/) instead when you need to know how often
  each line repeats. This tool only reports membership.
- Auditing DNS records, IP allow-lists, or environment variable names for entries that exist in one
  environment but not another.

## Tips and pitfalls

- The comparison is exact per line: two lines that differ only by trailing punctuation or internal
  spacing are treated as different members. Run [collapse whitespace](/util/collapse_whitespace/) as an
  earlier pipeline step if runs of internal spaces should not matter.
- Order in the output follows first appearance: your input's lines first, then (for union and symmetric
  difference) the other list's. So it mirrors the original lists rather than any sorted order. Turn on
  **sort result** if you need a sorted order instead.
- This tool compares whole lines, not individual words or characters. To compare word lists that were
  typed one per line, this works directly; to pull structured values (emails, URLs, IDs) out of free text
  first, try [extract matches](/util/extract_preset/).
