---
title: Initials Generator — Turn a Phrase into an Acronym
description: Generate initials or an acronym from any phrase online. Choose the separator, casing, and whether to skip small words like "the" or "of".
---
## What does this tool do?

This tool builds an acronym or set of initials from a phrase by taking the first letter of each word — `Portable Network Graphics` becomes `PNG`, `Node.js Foundation` becomes `N.J.F` with a dot separator. It is the same idea behind naming a monogram, an organization's short name, or a compact label for a long heading.

```example
title: the first letter of each word
input: Portable Network Graphics
output: PNG
```

## How it works

A "word" is any run of letters or digits; punctuation, whitespace, and hyphens all break one word from the next, so `Jean-Luc Picard` becomes `JLP` and `U.S.A.` becomes `USA`. An apostrophe inside a word does not break it, so `don't panic` becomes `DP`, treating `don't` as a single word.

For each word the tool keeps, it takes the first character — a full Unicode code point, so a precomposed accented letter or a character outside the Basic Multilingual Plane is never cut in half — and optionally uppercases it. Uppercasing is done carefully: a few characters expand into more than one letter when uppercased (`ß` becomes `SS`, the ligature `ﬁ` becomes `FI`), and using the whole expansion would let a single word contribute two letters to the acronym instead of one. This tool keeps only the first letter of that expansion, so `ßeta gamma` still becomes the two-letter acronym `SG`, not the three-letter `SSG`.

```example
title: hyphens and periods split words; apostrophes do not
input: Jean-Luc Picard
output: JLP
```

## Skipping small words

Turning on **skip small words** drops common short words — articles, conjunctions, and prepositions such as "a", "the", "of", "and", "in" — from the acronym, except when one of them is the very first word, which is always kept so the phrase's leading word never disappears entirely.

```example
title: small words are skipped, except the leading word
params: {"skipSmallWords": true}
input: The Lord of the Rings
output: TLR
```

## Options

- **separator** — inserted between each initial; empty by default, so the letters run together. Because this is a single-line text field, it understands the backslash escapes `\n`, `\r`, and `\t` for cases you cannot type directly.
- **uppercase** — uppercases every initial (default on). Turn it off to keep each word's original casing.
- **skip small words** — drops the built-in list of short words, other than the first, from the result (default off).
- **max length (0 = no limit)** — stops once this many initials have been collected. `0` means no limit (default).

```example
title: a separator and a length limit together
params: {"separator": ".", "maxLength": 2}
input: Portable Network Graphics
output: P.N
```

## Common uses

- Turning a project, organization, or product name into a short acronym or abbreviation.
- Building a monogram or short label from someone's name.
- Generating compact column headers or tags from longer descriptive phrases.
- Producing a consistent short code for entries in a list, spreadsheet, or file name.

## Tips and pitfalls

- Numbers count as word characters, so `Apollo 13` contributes an initial for `13` as well as `Apollo`, giving `A1`.
- Input with no letters or digits at all — just punctuation and spaces — produces an empty result rather than an error.
- `maxLength` counts finished initials, not input characters, so it stays correct even when uppercasing expands a letter into more than one character behind the scenes.
- This tool only looks at the first letter of each word; it does not know which words are meaningful to your particular acronym (`NASA` drops the "and" in National Aeronautics and Space Administration by convention; this tool keeps it unless you turn on **skip small words**).
- Accented letters written as a base letter plus a separate combining accent (decomposed text) are not handled: the accent mark breaks the word in two and adds a stray initial, and the accent itself is dropped. Run [normalize](/util/normalize/) with NFC first if your text may be decomposed.
- There is no utility for expanding an acronym back into words. If you want only the capital letters of a phrase rather than the first letter of every word, [regex_extract](/util/regex_extract/) with the pattern `[A-Z]` lists them, one per line.
- Pair with [case](/util/case/) if you want to adjust the casing of the source phrase before building initials from it.
