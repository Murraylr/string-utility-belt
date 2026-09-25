---
title: Tabs to Spaces Converter Online (and Back)
description: Convert tabs to spaces or spaces back to tabs online using real tab stops, like expand/unexpand. Set the tab width and convert leading indentation only.
---
## What does converting tabs and spaces do?

Some editors and file formats indent with tab characters, others with spaces, and mixing the two in one file causes misaligned code once anyone views it with a different tab width. This tool converts tabs to spaces or spaces back to tabs, using real tab-stop math rather than a naive one-tab-equals-N-spaces replace — the same job as the Unix `expand` and `unexpand -a` commands, except that the default tab width here is 4 rather than their 8, and spaces-to-tabs converts runs anywhere in the line unless you turn on leading-only mode.

## How it works

A tab does not always advance the same number of columns; it advances to the *next* tab stop, spaced every `tabWidth` columns. Converting **tabs to spaces** (the default direction) replaces each tab with exactly enough spaces to reach the next stop from its actual column position:

```example
title: tabs expand to the next tab stop, not a fixed count
input: 	foo	bar
output:     foo bar
```

Notice the second tab above becomes a single space, not four — counting columns from 0, it sits at column 7 (right after `foo`), and the next tab stop at width 4 is column 8, so only one space is needed to get there.

Converting **spaces to tabs** does the reverse: a run of two or more spaces (or any run containing a tab) that reaches a tab stop is collapsed into tabs, with any leftover spaces kept if the run stops short of the next stop:

```example
title: collapsing indentation spaces back into tabs
params: {"direction": "spaces-to-tabs"}
input:         indented
output: 		indented
```

A single space is always left alone in this direction, since a lone space is ordinary word spacing, not indentation:

```example
title: a single space is never converted to a tab
params: {"direction": "spaces-to-tabs"}
input: a b
output: a b
```

### Tab width and leading-only conversion

**Tab width** controls how many columns apart the stops are:

```example
title: a wider tab width changes how many spaces a tab expands to
params: {"tabWidth": 8}
input: 	a
output:         a
```

Turning on **leading whitespace only** stops the conversion as soon as it reaches the first non-whitespace character on a line, leaving any tabs or spaces later in the line untouched — useful when you only want to fix indentation without touching aligned tables or comments further along the line:

```example
title: leadingOnly touches only the indentation, not a later tab
params: {"leadingOnly": true}
input: 	a	b
output:     a	b
```

Empty input returns empty output:

```example
title: empty input
input:
output:
```

## Options

- **direction** (`direction`, default `tabs-to-spaces`) — `tabs-to-spaces` or `spaces-to-tabs`.
- **tab width** (`tabWidth`, default `4`, 1–64) — the column spacing between tab stops used by both directions.
- **leading whitespace only** (`leadingOnly`, default `false`) — when `true`, only the run of whitespace at the very start of each line is converted; everything from the first non-whitespace character onward is left as-is.

## Common uses

- Normalizing indentation in a file before committing it to a codebase with a house style of tabs or spaces.
- Preparing text for a context — a terminal, a fixed-width report, a diff view — where tab width is unpredictable, by converting tabs to spaces so alignment is guaranteed.
- Converting spaces back to tabs to shrink file size or match an editor configuration that expects tab indentation.

## Tips and pitfalls

- The two directions are exact inverses for indentation made of tabs (optionally followed by a few alignment spaces): converting tabs to spaces and then back to tabs with `leadingOnly` set reproduces the original, as long as the tab width is the same both times. Indentation that mixes spaces before tabs comes back normalized, not as it was.
- `leadingOnly` is about position, not intent — a tab used for mid-line alignment (for example, inside a table) is left untouched in that mode, which is usually what you want, but is worth checking if a line mixes indentation and alignment in unusual ways.
- Every code point counts as a single column when computing tab stops, including astral characters such as emoji. Wide characters that a terminal renders across two columns (most CJK text) are still counted as one column here, and combining accents count as a column of their own, so tab alignment on such text may not match a terminal's own display width.
- To pad individual values to a fixed width instead of converting between two whitespace styles, see [pad](/util/pad/); to line up whole columns of delimited text, see [align columns](/util/align_columns/).
