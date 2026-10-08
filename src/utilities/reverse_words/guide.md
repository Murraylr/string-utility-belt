---
title: Reverse Word Order Online: Flip Sentence Words
description: Reverse the order of words in a line or across a whole text online, using a custom separator, and see worked examples.
---
## What does reversing word order mean?

Reversing word order keeps every word intact but flips the sequence they appear in, so "the quick brown fox" becomes "fox brown quick the". This is different from [reverse](/util/reverse/), which flips the individual characters of the text and would turn "the quick brown fox" into unreadable "xof nworb kciuq eht". Reversing word order is useful for testing text layout, generating quirky variations of a sentence, or undoing a word order that got scrambled by another process.

## How it works

The tool splits the text on a **separator** (a space by default), reverses the resulting list of pieces, and joins them back together with the same separator. Because the split and join both use the exact separator string, any run of text between two separators (whether that is a real word or something else entirely) is treated as one unit and kept intact.

```example
title: reverse word order in a sentence
input: the quick brown fox
output: fox brown quick the
```

The **separator** is not limited to a space. Any literal string works, which lets you reverse comma-separated values, colon-separated fields, or anything else split by a fixed marker:

```example
title: reverse comma-separated values
params: {"separator": ","}
input: a,b,c
output: c,b,a
```

**Per line** (on by default) makes the tool treat each line independently, reversing the words within a line but never moving words across a line break. This is what you almost always want for multi-line text. Turning it off reverses across the *entire* input as one long sequence of separator-delimited pieces, so a newline that happens to fall inside a "word" (because it wasn't the separator you split on) travels along with that piece instead of marking a line boundary:

```example
title: with "per line" off, newlines travel with their word
params: {"perLine": false}
input:
a b
c d
output:
d b
c a
```

The separator field understands a few backslash escapes so you can target characters that are awkward to type into a single-line box: `\n` for newline, `\r` for carriage return, `\t` for tab, and `\\` for a literal backslash.

```example
title: using \n as an escaped separator
params: {"separator": "\\n", "perLine": false}
input:
a
b
output:
b
a
```

If the input is empty, the result is empty regardless of any other option. An empty separator is rejected outright, since splitting on nothing would not produce a meaningful sequence of words to reverse.

## Options

- **separator**: the string used to split the text into pieces before reversing their order. Defaults to a single space. Supports the `\n`, `\r`, `\t` and `\\` escapes described above. Must not be empty.
- **per line**: when on (the default), each line is reversed independently and line breaks are preserved exactly where they were, including a trailing `\r` on Windows-style CRLF lines. When off, the whole input is treated as one sequence split on the separator.

## Common uses

- Generating test data or quick word-order variations of a sentence for QA or content review.
- Reversing the field order of a delimiter-separated record, such as `last,first` to `first,last` (for a two-field case; for more structured reordering, a dedicated CSV tool is a better fit).
- Undoing an accidental reversal, since running the tool twice on the same separator restores the original order.

## Tips and pitfalls

- If a line does not contain the separator at all, that whole line is treated as a single "word" and comes back unchanged. That includes a `\n` separator with **per line** on: each line has no newline left in it, so turn **per line** off when splitting on newlines.
- Consecutive separators produce empty pieces that are reversed along with the words, so `a  b` (two spaces) becomes `b  a`, not `b a`.
- With "per line" on, each line's own trailing carriage return (from CRLF endings) is preserved in place, so mixed-ending files are not silently normalized.
- To also flip character order within each word (not just the word order), combine this with [reverse](/util/reverse/) in a separate step.
- If you need to reorder based on sorting rather than reversing, see [sort words in line](/util/sort_words_in_line/) instead.
- For reversing the order of entire lines rather than words within a line, use [reverse line order](/util/line_reverse/).
