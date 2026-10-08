---
title: Trim Lines Online: Strip Whitespace from Every Line
description: Trim whitespace, or a custom set of characters, from the start, end, or both sides of every line in a block of text, with worked examples.
---
## What does trimming every line do?

A plain trim function removes leading and trailing whitespace from a whole string, but leaves any
whitespace inside the middle lines untouched. This tool applies that trim to **every line separately**,
so a block of text with ragged indentation, trailing spaces copied from a spreadsheet, or inconsistent
padding around each row comes out clean on every line at once, not just at the very start and end of the
document.

## How it works

The text is split into lines (any mix of `\n`, `\r\n` or `\r` is recognized), and each line has characters
removed from the side you choose until it hits a character that should stay. By default that means
Unicode whitespace (spaces, tabs, non-breaking spaces, and similar) on both sides of each line:

```example
title: trim both sides of every line
input:
  hello  
  world  
output:
hello
world
```

Set **side** to `start` or `end` to trim only one side, leaving the other exactly as it was:

```example
title: trimming only the start
params: {"side": "start"}
input:
  hi  
  there  
output:
hi  
there  
```

### Trimming a custom set of characters

Leave **characters** blank to trim whitespace (the default). Fill it in and the tool switches entirely to
trimming only the characters you list. Whitespace is then left alone unless you include it yourself:

```example
title: trimming dashes instead of whitespace
params: {"characters": "-"}
input:
--a--
--b
output:
a
b
```

The characters field accepts the typed escapes `\n`, `\r`, `\t`, `\0` and `\\` so you can trim a tab or a
literal backslash without pasting an invisible character:

```example
title: trimming a tab via a typed escape
params: {"characters": "\\t"}
input: 	a	
output: a
```

## Options

- **side**: `both` (default), `start`, or `end`. Controls which edge of each line is trimmed.
- **characters**: leave blank to trim Unicode whitespace (the default). Enter one or more characters to
  trim exactly that set instead, in any order, from the chosen side(s).

## Things to know

- Whitespace and a custom character set are mutually exclusive: as soon as **characters** holds anything,
  whitespace is no longer trimmed unless you list a space or `\t` yourself.
- The custom character set is matched by whole Unicode code point, so you can safely include an emoji or
  other astral character in it without it being split in half.
- A non-breaking space (U+00A0) and the CJK ideographic space (U+3000) count as whitespace and are trimmed
  by default, but a zero-width space (U+200B) does not. It is invisible but not whitespace, so it survives
  an ordinary trim and has to be listed explicitly in **characters** if you want it removed.
- The document's trailing newline (or lack of one) is preserved. Lines are rejoined with a single
  line-ending style: CRLF if the input uses it anywhere, otherwise LF (or CR for a CR-only file). So a
  file with mixed endings comes out uniform.
- Blank lines and lines made entirely of trimmable characters simply become empty. They are not removed
  from the output. Use [remove blank lines](/util/remove_blank_lines/) afterwards if you want them gone too.

## Common uses

- Cleaning up text pasted from a terminal, PDF, or spreadsheet where every line picked up trailing spaces
  or inconsistent leading indentation.
- Stripping leading or trailing runs of marker characters, such as `-` or `#`, from every line of a list
  before further processing. The set is matched character by character, not as a fixed prefix: `-#`
  strips any mix of dashes and hashes from the edge, however many there are.
- Preparing text for an exact line-by-line comparison with [text diff](/util/text_diff/) or
  [line set operations](/util/set_operations/), where stray whitespace would otherwise make identical
  lines look different.
- Combining with [collapse whitespace](/util/collapse_whitespace/) when runs of spaces inside each line
  also need squeezing. This tool only touches the edges of lines, while [trim](/util/trim/) only touches
  the start and end of the whole text.
