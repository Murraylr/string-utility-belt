---
title: Word Wrap Online — Wrap Text to a Fixed Column Width
description: Wrap text to a fixed column width online, breaking on word boundaries. Optional long-word breaking, line indent, paragraph reflow, and trailing spaces.
---
## What does word wrapping do?

Word wrapping breaks a long line of text into several shorter lines, each no wider than a chosen column count, splitting only at spaces so words are not cut apart (unless you ask it to). It is the job the Unix `fmt` and `fold -s` commands do and that plain-text email clients do when composing, and is the natural counterpart to [unwrap / reflow](/util/unwrap/), which joins wrapped lines back together.

## How it works

Words are packed onto each line greedily: as many whole words as fit within the **width**, then a break, repeating until the text is used up. A word that would push the line past the width starts a new line instead of being split. Runs of spaces and tabs between words collapse to a single space, any leading indentation on a line is dropped (use **indent** to add it back), and the output always uses `\n` line breaks, even if the input used `\r\n` or `\r`:

```example
title: wrapping to a fixed width
params: {"width": 20}
input: The quick brown fox jumps over the lazy dog
output: The quick brown fox
jumps over the lazy
dog
```

### Breaking long words

By default, a single word longer than the width is left whole and allowed to overflow its line rather than being cut apart. Turning on **break long words** hard-breaks it at the width instead, by code point; if the current line still has room, the head of the word fills it first:

```example
title: breaking a word that is longer than the width
params: {"width": 4, "breakLongWords": true}
input: abcdefghij
output: abcd
efgh
ij
```

### Indenting wrapped lines

An **indent** string is prepended to every output line and counts against the available width, so the wrapped text still fits within the total column count you expect:

```example
title: indenting every wrapped line, like a quoted reply
params: {"width": 10, "indent": "> "}
input: one two three
output: > one two
> three
```

### Reflowing existing line breaks

By default, **reflow wrapped lines** is on: existing line breaks within a paragraph are ignored and the whole paragraph is rewrapped from scratch, while blank lines still separate paragraphs. Turning it off wraps each existing line independently instead, preserving line breaks that already fit:

```example
title: preserving existing line breaks instead of reflowing them
params: {"width": 80, "preserveParagraphs": false}
input: line one
line two

second para
output: line one
line two

second para
```

### Keeping the soft-break trailing space

Turning on **keep trailing space** appends the space that was consumed by a word-boundary break to the end of each line (except the last line of each paragraph), which is useful if a downstream tool expects the original inter-word space to still be present somewhere in the text:

```example
title: keeping the space that caused each word-boundary break
params: {"width": 4, "trailingSpaces": true}
input: aaa bbb ccc
output: aaa 
bbb 
ccc
```

Empty input produces empty output, and blank-line paragraph breaks are always preserved:

```example
title: empty input
input:
output:
```

## Options

- **width** (`width`, default `80`, whole numbers ≥ 1) — the maximum number of columns per line, measured in Unicode code points (so an emoji or other astral character counts as one, not as two UTF-16 code units).
- **break long words** (`breakLongWords`, default `false`) — hard-breaks a single word that is longer than the available width, instead of letting it overflow.
- **line indent** (`indent`, default empty) — text prepended to every output line, subtracted from the available width for wrapping. Blank lines between paragraphs stay empty, without the indent. It may not contain a line break.
- **reflow wrapped lines** (`preserveParagraphs`, default `true`) — when `true`, a paragraph's existing line breaks are discarded and it is rewrapped as one block; when `false`, each existing line is wrapped independently.
- **keep trailing space** (`trailingSpaces`, default `false`) — keeps the space from an actual word-boundary break at the end of the line it broke from. A break forced through the middle of a long word never gets a trailing space, since that space would otherwise glue itself onto the broken word if the text were ever reflowed.

## Common uses

- Formatting plain-text email replies, commit messages, or terminal output to a conventional width such as 72 or 80 columns.
- Wrapping long labels or descriptions to fit a fixed-width display or printed report.
- Preparing paragraphs for a quoted-reply style, using the indent option to prefix each line with `> `.

## Tips and pitfalls

- With `preserveParagraphs` on (the default), wrapping a paragraph and then running it through [unwrap](/util/unwrap/) usually gives back the original paragraph — provided it had single spaces between words, no word had to be hard-broken, and no wrapped line happens to start with something unwrap takes for a list marker, such as `- ` or `1. `.
- Width is measured in code points, not display columns, so wide CJK characters and combining marks are not weighted specially the way they are in [box text](/util/box_text/) or [align columns](/util/align_columns/).
- An `indent` that is as wide as, or wider than, `width` leaves no room for any text and is rejected rather than producing an empty or broken wrap.
- To rejoin wrapped lines back into full paragraphs, use [unwrap / reflow](/util/unwrap/); to pad or box a single already-short line instead of wrapping long text, see [pad](/util/pad/) or [box text](/util/box_text/).
