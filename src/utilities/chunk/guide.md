---
title: Chunk Text Online: Split Strings into Fixed-Size Groups
description: Split text into fixed-size groups of characters, words, or lines, rejoin them with a separator, and pad the last group to a uniform size.
---
## What does chunking text mean?

Chunking breaks a long piece of text into fixed-size groups and glues those groups back together with a separator of your choice. It is the same idea as splitting a phone number into groups of digits or breaking a long identifier into readable blocks, generalized to three different units: characters, words, or lines. Unlike [word_wrap](/util/word_wrap/), which breaks lines at a target width and, unless told to break long words, never inside a word, chunking cuts mechanically at the Nth unit regardless of what sits at that boundary.

## How it works

The **unit** option decides what one "item" is before grouping:

- **characters** (default): every Unicode code point counts as one item, so an astral character such as 😀 is a single unit and is never cut into two surrogate halves. Emoji built from several code points (skin-tone modifiers, flags, ZWJ sequences) and letters followed by a separate combining accent count as several items, and can be split between groups.
- **words**: runs of non-whitespace characters. Whatever whitespace separated the original words is discarded; the words inside a rejoined group are put back together with a single space.
- **lines**: the text split on newlines. A single trailing newline at the very end of the input is treated as a line terminator, not as an extra empty final line, so `"a\nb\n"` chunks the same way as `"a\nb"`.

The tool walks through the items **size** at a time, joins the items inside each group (nothing for characters, a space for words, a newline for lines), and finally joins the groups themselves with the **separator**.

```example
title: split characters into fixed-size groups
params: {"size": 3, "unit": "characters", "separator": "-"}
input: abcdefgh
output: abc-def-gh
```

```example
title: chunk by words, five words at size 2
params: {"unit": "words", "size": 2}
input: one two three four five
output:
one two
three four
five
```

A trailing newline does not produce a stray empty last group:

```example
title: a trailing newline is not an extra empty line
params: {"unit": "lines", "size": 2, "separator": "---\\n"}
input:
a
b
c
d
e

output:
a
b---
c
d---
e
```

## Padding the last chunk

When the input does not divide evenly by **size**, the final group comes out short. Turning on **pad last chunk** fills the missing slots with the **pad character** so every group in the output ends up the same size. That is useful when the output must be a fixed-width record. For character chunks, the pad string's own characters are cycled in one at a time, so a multi-character pad value produces an alternating fill; for word and line chunks, the whole pad string is repeated as a single filler word or line for each missing slot.

```example
title: pad the last group of characters to a uniform width
params: {"size": 5, "padLast": true, "padChar": "."}
input: abcdefgh
output:
abcde
fgh..
```

Only the final group is ever padded. A group that already has `size` items is left untouched, and disabling **pad last chunk** leaves the last group short.

## Options

- **chunk size**: items per group; a whole number of 1 or more (0 or a negative number is rejected).
- **unit**: `characters`, `words`, or `lines`, as described above.
- **separator**: placed between groups in the output, never inside one. Because a single-line text field cannot hold a literal newline or tab, it understands the backslash escapes `\n`, `\r`, `\t`, `\0` and `\\`; the default is a newline.
- **pad last chunk**: off by default; extends only the last group.
- **pad character**: the fill value used when padding is on (default a single space); it understands the same backslash escapes as the separator.

## Common uses

- Grouping digits of a card number, account number, or phone number into readable blocks.
- Breaking a long single-line value (a hash, a Base64 blob, a hex dump) into fixed-width rows for display or a report.
- Splitting a big word list into rows of a fixed number of items.
- Building fixed-width records for a legacy file format, using **pad last chunk** to guarantee every row is the same length.

## Tips and pitfalls

- Chunk size counts Unicode code points, not UTF-16 units, so astral characters such as 😀 always stay whole. If your text combines base letters with separate accent marks, run [normalize](/util/normalize/) with NFC first so letters that have a precomposed form (like `é`) count as a single character rather than two.
- With `words`, the original whitespace is not kept: words inside a group are rejoined with a single space, and line breaks between words are lost. Chunk by `lines` or `characters` instead if the exact spacing has to survive.
- Chunking never adds or removes characters apart from the separators and any padding. Padding is the one way the output can grow a lot: with **pad last chunk** on, a very large chunk size pads the last group out to that full size.
- For a different way to split and reassemble text around a delimiter you choose, see [split_join](/util/split_join/).
