---
title: Indent / Dedent Text Online — Add or Remove Leading Spaces
description: Add or remove leading indentation on every line online, or auto-dedent by stripping the common whitespace prefix, using spaces or tabs.
---
## What does indenting and dedenting mean?

Indentation is the leading whitespace at the start of a line, used to show nesting in code, quoted text, or an outline. This tool adds a fixed amount of indentation to every line, removes a fixed amount, or automatically strips whatever leading whitespace every line shares in common — the same idea as Python's `textwrap.dedent`, useful for cleaning up a block of text that was copied out of an indented context such as a multi-line string literal.

## How it works

The `mode` option chooses one of three behaviors:

- **add** inserts the pad character, repeated `amount` times, at the start of every line.
- **remove** strips up to `amount` copies of the pad character from the start of every line — if a line has fewer than `amount`, only what is actually there is removed.
- **auto-dedent** finds the longest whitespace prefix shared by every non-blank line and removes exactly that much from each line, whatever mix of spaces and tabs it is made of. The prefix must match character for character, so a tab-indented line and a space-indented line share no common indent.

```example
title: add two spaces to every line
params: {"amount": 2, "character": "space"}
input: a
b
output:   a
  b
```

Indentation can use tab characters instead of spaces:

```example
title: indent with a tab character
params: {"character": "tab", "amount": 1}
input: a
b
output: 	a
	b
```

```example
title: remove up to two leading spaces
params: {"mode": "remove", "amount": 2}
input:     a
  b
c
output:   a
b
c
```

`auto-dedent` ignores the `amount` and `character` options entirely — it measures the shortest common indent itself:

```example
title: auto-dedent strips the common leading whitespace
params: {"mode": "auto-dedent"}
input:     a
    b
output: a
b
```

By default, blank lines are left untouched instead of being padded out with trailing whitespace; turning `skipBlank` off indents blank lines too:

```example
title: indenting blank lines when skipBlank is off
params: {"skipBlank": false}
input: a

b
output:   a
  
  b
```

Empty input is returned unchanged:

```example
title: empty input
input:
output:
```

## Options

- **mode** (`mode`, default `add`) — `add`, `remove`, or `auto-dedent`, as described above.
- **amount** (`amount`, default `2`, 0–64, whole numbers only) — how many pad characters to add or remove per line. Ignored by `auto-dedent`.
- **character** (`character`, default `space`) — `space` or `tab`, the unit that is added or removed. Ignored by `auto-dedent`, which matches whatever whitespace is already there.
- **skip blank lines** (`skipBlank`, default `true`) — when adding or removing, blank lines (containing only whitespace, or nothing) are left exactly as they are instead of gaining or losing padding.

## Common uses

- Cleaning up a block of code, log output, or a quoted email that was copied with extra leading indentation.
- Preparing a multi-line string literal for embedding in source code where the surrounding indentation would otherwise be included literally.
- Increasing or decreasing the nesting level of a block of lines when reformatting code or Markdown by hand.

## Tips and pitfalls

- `remove` only strips the exact pad character you chose: removing tabs never touches a line indented with spaces, and vice versa. If a file mixes the two, run it twice with different `character` values.
- `auto-dedent` looks at every non-blank line, so a single line with less indentation than the rest limits how much can be stripped from all of them.
- A trailing empty line produced by a final newline in the input is never itself indented, so `add` cannot introduce a stray line of trailing whitespace at the very end of the text.
- To normalize tabs and spaces against each other rather than just adding or removing a fixed amount, see [tabs ↔ spaces](/util/tabs_spaces/).
- To reflow wrapped text instead of adjusting indentation, see [unwrap / reflow](/util/unwrap/) or [word wrap](/util/word_wrap/).
