---
title: Ordinalize Numbers Online — 1 to 1st, 2 to 2nd
description: Turn whole numbers into ordinals online — short suffix form (1st, 2nd) or spelled-out words (first, second) — one value per line.
---
## What does "ordinalize" mean?

Ordinalizing a number turns a plain count into a position: `1` becomes "1st," `2` becomes "2nd," and
so on. English ordinal suffixes follow the last digit of the number with three exceptions — 11, 12,
and 13 (and every number ending in those two digits, like 111 or 213) always take "th," never "st,"
"nd," or "rd," regardless of what their last digit alone would suggest.

## How it works

**style** chooses between the short suffix form (default) and full words:

```example
title: adding the ordinal suffix (default style)
input: 21
params: {"style": "suffix"}
output: 21st
```

```example
title: spelling the ordinal out in words
input: 3
params: {"style": "words"}
output: third
```

The 11/12/13 exception applies based on the last **two** digits, not the last one, so it also catches
111, 112, 213, and every other number in that pattern — not just the numbers 11 through 13 themselves:

```example
title: 11, 12 and 13 always take "th", never "st"/"nd"/"rd"
params: {"style": "suffix"}
input:
11
12
13
output:
11th
12th
13th
```

The tool is idempotent on input that is already ordinal — running it again on "3rd" just normalizes
the casing and returns "3rd" unchanged, rather than appending a second suffix — which makes it safe to
apply to a mixed list of plain and already-ordinal numbers:

```example
title: already-ordinal input is recognized and left correct
input: 21ST
params: {"style": "suffix"}
output: 21st
```

## Options

- **style** — `suffix` (default, `1st`/`2nd`/`3rd`/`4th`) or `words` (`first`/`second`/`third`).
- **per line** — on by default; ordinalizes each line separately, preserving blank lines and
  leading/trailing whitespace around each value.

## Common uses

- Formatting a rank, position, or date-of-month for display ("finished 3rd," "the 1st of May").
- Generating ordinal labels in a list or table (1st, 2nd, 3rd, …) without hand-writing the suffix
  logic and its exceptions.
- Normalizing a mixed batch of plain and already-suffixed numbers into one consistent form.
- Spelling ordinals out in full for prose or accessibility text where digits-plus-suffix would read
  awkwardly aloud.

## Tips and pitfalls

Only whole numbers are accepted — `3.5` and non-numeric text both raise a clear "not a whole number"
error rather than guessing at a suffix. A suffix that is not directly attached to the digits (`"12 st"`
with a space) is rejected too, so stray text is never mistaken for part of the number. Digit-group
separators (commas, underscores, spaces) are only stripped when they form well-formed three-digit
groups — `1,234` becomes `1,234th`, but `1,2` is rejected rather than silently read as 12. For spelling
out cardinal numbers, years, or currency amounts instead of just ordinal position, see
[number ↔ words](/util/number_words/); for Roman numerals, see
[roman numerals](/util/roman_numerals/); for grouping or otherwise formatting a plain number, see
[number format](/util/number_format/).
