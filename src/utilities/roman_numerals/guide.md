---
title: Roman Numeral Converter: Number to MCMXCIV and Back
description: Convert whole numbers from 1 to 3999 to Roman numerals online, or strictly parse Roman numerals back to numbers, one value per line.
---
## What are Roman numerals?

Roman numerals write numbers with combinations of seven letters: I (1), V (5), X (10), L (50), C
(100), D (500) and M (1000). The letters are added together, with a subtractive shortcut for the 4s and 9s of each
decimal place: IV (4) instead of IIII, IX (9), XL (40), XC (90), CD (400), and CM (900). This tool
converts in both directions and only produces or accepts that standard subtractive form, the one
used for movie copyright years, Super Bowl numbers, and regnal names. Looser variants are rejected. (Many
clock faces write 4 as IIII, which this parser rejects.)

## How it works

Set **direction** to `to-roman` (default) or `to-arabic`. Converting to Roman numerals greedily takes
the largest value it can at each step, including the six subtractive pairs, which is what produces the
canonical form:

```example
title: number to Roman numeral (the default direction)
input: 1994
params: {"direction": "to-roman"}
output: MCMXCIV
```

```example
title: Roman numeral back to a number
input: MCMXCIV
params: {"direction": "to-arabic"}
output: 1994
```

Parsing is strict: it only accepts numerals that could have come from this same canonical encoding, so
non-standard forms like `IIII` (should be `IV`), `VV`, or `IC` (which is not a valid subtraction at
all) are rejected rather than guessed at. Lowercase input, spacing, and periods between letters
(`m.c.m.` reads as 1900) are normalized before parsing, and the Unicode Roman numeral characters
(Ⅻ, ⅳ, and similar) are expanded to plain letters first:

```example
title: Unicode Roman numeral characters are expanded before parsing
input: Ⅻ
params: {"direction": "to-arabic"}
output: 12
```

With **per line** left on, each line converts independently, so a whole list can be processed in one
step:

```example
title: converting a list, one numeral per line
params: {"direction": "to-roman"}
input:
1
2
3
output:
I
II
III
```

## Options

- **direction**: `to-roman` (default) or `to-arabic`.
- **per line**: on by default; converts each line separately, preserving blank lines and surrounding
  whitespace around each value.

## Common uses

- Converting a chapter, movie sequel, or Super Bowl number into or out of Roman numeral form.
- Validating that a Roman numeral appearing in a document or dataset is well-formed before further
  processing.
- Reading a copyright year or monument date written in Roman numerals back into a plain number.
- Generating a batch of Roman numerals for numbering (I, II, III, …) in one pass.

## Tips and pitfalls

Roman numerals only cover 1 through 3999 here. There is no standard, universally recognized notation
for zero or for numbers of 4000 and above (historical extensions exist but are not standardized), so
values outside that range raise a clear "roman numerals cover 1-3999" error instead of guessing at an
extension. Parsing rejects any numeral that is not in canonical subtractive form, which catches common
mistakes like writing `IIII` for 4 or `IC` for 99 (the correct forms are `IV` and `XCIX`). If a numeral
you expected to work is rejected, it is very likely not in the standard form. For converting a
positional number base like binary or hex instead, see
[number base convert](/util/number_base_convert/); for spelling numbers out in English words, see
[number ↔ words](/util/number_words/) or [ordinalize](/util/ordinalize/) for ordinal positions.
