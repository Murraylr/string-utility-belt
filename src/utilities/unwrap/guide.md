---
title: Unwrap Text Online: Join Wrapped Lines Into Paragraphs
description: Join soft-wrapped lines back into paragraphs online. Keeps blank-line breaks, list items, and indented code blocks intact while reflowing prose.
---
## What does unwrapping text do?

Text that was hard-wrapped to a fixed column width (an email, a plain-text file, output copied from a terminal) breaks each paragraph into several separate lines even though it is meant to be read as one continuous block. Unwrapping reverses that: it joins those lines back into single-line paragraphs, while still respecting blank lines as intentional paragraph breaks. It is the natural undo for [word wrap](/util/word_wrap/), with a similar effect to running the Unix `fmt` command with a very large width.

## How it works

Lines are joined with a separator (a single space by default) until a blank line is reached, which starts a new paragraph. `\n`, `\r\n` and `\r` are all recognized as line breaks, but the output always uses `\n`. Trailing whitespace on each line and leading whitespace on joined continuation lines is dropped:

```example
title: joining a soft-wrapped paragraph
input: This is a
wrapped paragraph.
output: This is a wrapped paragraph.
```

Blank lines are preserved as paragraph breaks rather than being joined away, and by default, list items and indented blocks are recognized and kept on their own lines instead of being merged into the surrounding prose:

```example
title: blank lines stay as breaks; list items keep their own line
input: Notes:

- first point
  continued
- second point
output: Notes:

- first point continued
- second point
```

A wrapped continuation of a list item (a line that is not itself a new bullet) is joined onto that bullet rather than starting a new paragraph, which is why "continued" above ends up appended to "first point" instead of becoming its own line.

### Custom separator

The text used to join lines together is configurable, and is taken literally rather than treated as a template:

```example
title: joining with a custom separator
params: {"separator": " | "}
input: one
two
output: one | two
```

### Turning off list and indentation preservation

Turning off **preserve list items** merges list bullets into the surrounding paragraph just like ordinary wrapped lines:

```example
title: without preserveLists, bullets are merged into one line
params: {"preserveLists": false}
input: - one
  continued
- two
output: - one continued - two
```

An indented block (four or more columns of leading whitespace, with a tab counting as a full stop) is left completely untouched by default, since it usually represents code or preformatted content rather than wrapped prose:

```example
title: an indented block is left alone by default
input: intro text
    code();
tail
output: intro text
    code();
tail
```

Empty input stays empty:

```example
title: empty input
input:
output:
```

## Options

- **join with** (`separator`, default a single space): the text inserted between two lines being joined. It is used literally; a value like `$&` is just two characters, not a special replacement token. It may not contain a line break.
- **keep list items** (`preserveLists`, default `true`): recognizes bullet (`-`, `*`, `+`, `•`, and the `●`, `○`, `■` and similar glyphs that text copied from a PDF carries), numbered (`1.`, `1)`), lettered (`a.`, `a)`) and parenthesised (`(a)`, `(12)`, `(iv)`) list markers, plus blockquote arrows, and keeps each list item on its own line, joining only its wrapped continuations.
- **keep indented blocks** (`preserveIndented`, default `true`): leaves a line indented four or more columns (or by any tab) exactly as it is, instead of joining it into the surrounding paragraph.

## Common uses

- Restoring an email or plain-text document to full-width paragraphs before further editing or reformatting.
- Preparing hard-wrapped Markdown or plain text for a system that expects one paragraph per line.
- Cleaning up text copied from a terminal or a fixed-width report where wrapping broke up otherwise continuous sentences.

## Tips and pitfalls

- Unwrapping is the reverse of hard-wrapping, but it is not always a perfect inverse of [word wrap](/util/word_wrap/): if a very long word was broken mid-word rather than at a space, unwrapping would rejoin it with a separator in the middle rather than fusing it back together seamlessly.
- Non-breaking spaces and other special whitespace (figure space, narrow no-break space) are preserved rather than being treated as ordinary breakable spaces, so numbers or names that use them to prevent wrapping keep their formatting.
- A "list item" is detected line by line from a small set of common markers; unusual or custom bullet styles will not be recognized and will be treated as ordinary wrapped prose. The reverse can happen too: a wrapped line that happens to begin with a number or single letter plus a period and a space (such as `1999. Then`) is taken for a list item and starts a new line. Turn off **keep list items** if your prose trips over this.
- To wrap text back to a fixed width after editing it as continuous paragraphs, use [word wrap](/util/word_wrap/).
