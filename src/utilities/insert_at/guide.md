---
title: Insert Text at Position — String Splice Tool Online
description: Insert or overwrite text at any character position in a string online, counting from the end with negative positions, per line or across the whole input.
---
## What does this tool do?

This tool splices text into a string at a specific character position — like a text editor's cursor, but scriptable. Give it a position and some text, and it either inserts the text at that spot (shifting everything after it forward) or overwrites the existing characters starting there.

```example
title: insert into the middle of a string
params: {"text": ", dear", "position": 5, "mode": "insert"}
input: Hello World
output: Hello, dear World
```

## How positions work

Position `0` is before the very first character, and position `N` (the input's length) is after the last one. A position past either end is clamped to the nearest valid spot rather than causing an error, so you can pass an intentionally large number to always insert at the end.

```example
title: a position past the end is clamped, not rejected
params: {"text": "!", "position": 999}
input: hi
output: hi!
```

A **negative** position counts backward from the end: `-1` is the position right before the last character, so inserting there lands just ahead of it.

```example
title: a negative position counts from the end
params: {"text": "-", "position": -2}
input: 2024
output: 20-24
```

Positions are counted in whole Unicode characters (code points), not UTF-16 units, so an astral character such as 😀 is always a single position and is never split into surrogate halves (an emoji built from several code points, such as a flag or a skin-toned emoji, spans several positions) — `position: 2` in `a😀b` lands right after the emoji, not in the middle of it.

## Insert vs. overwrite

**Insert** mode (the default) pushes everything at and after the position forward to make room for the new text — nothing is lost. **Overwrite** mode instead replaces existing characters starting at the position with the inserted text, consuming as many original characters as the inserted text is long; if the text runs past the end of the input, the extra characters are simply appended.

```example
title: overwrite replaces characters instead of shifting them
params: {"text": "XY", "position": 2, "mode": "overwrite"}
input: abcdef
output: abXYef
```

## Options

- **text** — what to insert or overwrite with. Because this is a single-line field, it understands the backslash escapes `\n` and `\t` for characters you cannot type directly; leaving it empty makes the step a no-op.
- **position** — where to act, counting from `0`; negative counts from the end. Must be a whole number.
- **mode** — `insert` (shift existing text forward) or `overwrite` (replace it).
- **per line** — when on, the position is applied independently to every line of a multi-line input instead of once to the whole text.

```example
title: apply the same insertion to every line
params: {"text": "# ", "position": 0, "perLine": true}
input: a
b
output: # a
# b
```

## Common uses

- Inserting a prefix or marker at a fixed column, such as commenting out every line of code (`perLine` with position 0).
- Building fixed-position edits for structured or fixed-width text, such as inserting a delimiter at a known offset.
- Overwriting a known field inside a fixed-width record without disturbing its overall length.
- Quick one-off edits — adding punctuation, a suffix, or a separator — at a position you already know.

## Tips and pitfalls

- Writing `\n` in the **text** field inserts a real newline (`\r`, `\t` and `\\` work too), which is useful for splitting a line in two without a separate step.
- Because insert mode never truncates and overwrite mode consumes exactly the inserted text's length, overwriting near the end of a short string can extend it — overwriting with `XYZ` at position 2 of `abc` produces `abXYZ`, five characters from a three-character input.
- Empty input never causes an error: whatever the position, the result is just the inserted text.
- For splitting text apart rather than inserting into it, see [chunk](/util/chunk/); for rearranging or duplicating substrings by pattern instead of a fixed offset, see [multi_replace](/util/multi_replace/) or [regex_extract](/util/regex_extract/).
