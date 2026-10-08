---
title: Filter Lines by Length Online: Keep Lines in Range
description: Keep only the lines of text whose character or word count falls in a min/max range online, with an option to invert the match.
---
## What does filtering lines by length do?

This tool keeps only the lines of a multi-line text whose length falls between a minimum and a maximum, and discards the rest. "Length" can mean either the number of characters or the number of words in the line, depending on which unit you choose. It is a quick way to isolate short labels from long paragraphs, drop one-word lines from a list, or find outliers in a text file without writing a script.

## How it works

Every line of the input is measured against **min length** and **max length**, and only the lines that fall in that range are kept, in their original order.

```example
title: keep lines within a character range
params: {"min": 2, "max": 3, "unit": "characters"}
input:
a
bb
ccc
dddd
output:
bb
ccc
```

Setting **unit** to `words` counts whitespace-separated words instead of characters. The same line can pass or fail very differently depending on which unit you pick:

```example
title: keep lines with at least 2 words
params: {"min": 2, "max": 0, "unit": "words"}
input:
one two
three four five
six
output:
one two
three four five
```

**Max length** of `0` (the default) means there is no upper bound at all. Only **min length** is enforced. **Min length** of `0` similarly means no lower bound. Leaving both at `0` keeps every line, which makes this step a safe no-op to add to a pipeline before you have decided on real bounds (only mixed line endings are rewritten; see the tips).

**Invert** flips the result, keeping exactly the lines that would otherwise have been dropped:

```example
title: invert to keep only the lines outside the range
params: {"min": 2, "invert": true}
input:
a
bb
ccc
output: a
```

Length is measured in Unicode code points, not raw UTF-16 units, so an emoji like 🍎 counts as one character rather than two (emoji built from several code points, such as flags or skin-tone variants, still count as more than one):

```example
title: an emoji line counts as 2 characters, not 4
params: {"max": 2}
input:
🍎🍎
abc
output: 🍎🍎
```

## Options

- **min length**: the shortest a line may be to survive. Defaults to `0` (no minimum).
- **max length (0 = no max)**: the longest a line may be to survive. Defaults to `0`, meaning no maximum at all.
- **unit**: `characters` (Unicode code points) or `words` (whitespace-separated tokens, trimmed of surrounding whitespace before counting). Defaults to `characters`.
- **invert (keep non-matching)**: when on, lines outside the min/max range are kept instead of the lines inside it. Default off.

## Common uses

- Filtering out very short lines (like stray one- or two-character artifacts) or very long lines (like unwrapped paragraphs) from a text file.
- Isolating single-word lines from a mixed list of labels and sentences using the `words` unit with `max: 1`.
- Finding unusually long or short entries in a list of names, URLs, or log messages as a quick data-quality check.
- Combining with [grep lines](/util/grep_lines/) to filter by both content and length in the same pipeline.

## Tips and pitfalls

- A **min length** greater than a nonzero **max length** is rejected with an error rather than silently returning nothing, since it can never match any line.
- Bounds are compared exactly as entered, without rounding. A **min length** of `2.5` excludes a 2-character line but a **max length** of `2.5` includes it, since line lengths are always whole numbers.
- If every line is filtered out, the result is a truly empty string, not a single leftover blank line.
- Lines are split on LF, CRLF or a lone CR, and the kept lines are rejoined with one line ending for the whole document: CRLF if it appears anywhere in the input, otherwise LF (or CR for a CR-only file). A trailing newline at the end of the document is kept.
- To filter lines by matching text rather than length, use [grep lines](/util/grep_lines/); to remove genuinely blank lines regardless of length settings, use [remove blank lines](/util/remove_blank_lines/).
