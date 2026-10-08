---
title: Sort Words in a Line Online: Alphabetize Word Order
description: Sort the words within each line alphabetically or in reverse, with a custom separator, case folding, and duplicate word removal.
---
## What does sorting words in a line do?

This tool reorders the words inside each line of text, leaving the lines themselves in place. It is the
word-level counterpart to a line sorter: instead of putting whole lines in order, it alphabetizes the
words within every single line, independently. That makes it useful for normalizing tag lists, comparing
two sentences that use the same words in a different order, or turning a jumble of keywords into a
consistent, alphabetized form before diffing or deduplicating them.

## How it works

Each line is split on the **word separator** (a single space by default), the resulting words are sorted,
and the words are joined back together with the same separator. Sorting compares words by Unicode code
point, so results are consistent and don't depend on your browser's locale. With **ignore case** on (the
default), letters are compared without regard to case, but the original capitalization of each word is
kept in the output:

```example
title: ascending order, the default
input: banana apple cherry
output: apple banana cherry
```

Set **direction** to `desc` to reverse the order:

```example
title: descending order
params: {"direction": "desc"}
input: banana Apple cherry
output: cherry banana Apple
```

Turning off **ignore case** switches to a strictly code-point comparison, where every unaccented ASCII
uppercase letter sorts before every lowercase one, so a capitalized word like `Zeta` sorts ahead of a lowercase `alpha`
even though `alpha` comes first alphabetically:

```example
title: case-sensitive order treats capitals as "smaller"
params: {"ignoreCase": false}
input: Zeta alpha
output: Zeta alpha
```

**Remove duplicate words** drops repeated words (compared the same way case is compared) before sorting,
keeping the first occurrence of each. So with **ignore case** on, `Apple apple` keeps `Apple`:

```example
title: unique removes repeated words
params: {"unique": true}
input: c b a b
output: a b c
```

The separator does not have to be a space. Set **word separator** to any string (a comma, a pipe, a
custom delimiter) and the tool splits and rejoins on that exact text instead of whitespace:

```example
title: a comma-separated line
params: {"separator": ","}
input: b,a,c
output: a,b,c
```

Non-whitespace separators are treated literally, not as a regular expression, and they keep empty fields:
`b,,a` sorted on `,` produces `,a,b` (the empty field between the commas sorts first). You can also type
`\t` as the separator to split on a real tab instead of typing the character itself (and `\\` for a
literal backslash). Lines are always split on line breaks first, so a newline separator never matches
inside a line.

## Options

- **direction**: `asc` (default) or `desc`.
- **word separator**: the text each line is split on, default a single space. With a whitespace-only
  separator (a space or a tab), empty "words" are dropped, so runs of that separator (and any leading or
  trailing ones) collapse to a single separator in the output; any other separator keeps empty fields as
  real data.
- **remove duplicate words**: off by default. Removes repeated words before sorting (the first occurrence
  wins), using the same case sensitivity as **ignore case**.
- **ignore case**: on by default, so `Apple` and `banana` sort by letter regardless of case while keeping
  their original spelling in the output. Turn it off to sort strictly by code point.

## Common uses

- Normalizing space-separated tag lists or keyword sets so two equivalent lists compare equal, then
  feeding the result into [line set operations](/util/set_operations/) or [count duplicate lines](/util/uniq_count/).
- Alphabetizing the words in short labels, filenames built from multiple words, or CSS class lists.
- Preparing text for a word-order-insensitive diff: sort both sides with this tool first, then run
  [text diff](/util/text_diff/) on the results.
- Cleaning up manually typed lists where the words landed in an inconsistent order.

## Tips and pitfalls

- This sorts words within each line, not whole lines. To sort a list of lines instead, use
  [line sort](/util/line_sort/); to reverse the order of the words in a line without alphabetizing them,
  see [reverse words](/util/reverse_words/).
- Sorting is always by Unicode code point (folded for case when **ignore case** is on), never by locale
  collation, so results are identical on every machine, though accented letters sort by their code point
  rather than by dictionary order.
- Sorting compares whole code points, so emoji and other astral characters order correctly (after all
  BMP characters) and are never split in half.
- Blank lines and the trailing newline (or lack of one) are preserved. The output uses a single line-ending
  style: CRLF if the input contains any, otherwise LF (or CR for a CR-only file). So a file with mixed
  endings comes out uniform. With a space separator, a line of only spaces becomes empty and extra spaces
  around words are dropped.
