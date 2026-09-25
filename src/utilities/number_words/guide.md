---
title: Number to Words Converter — English, Both Directions
description: Spell numbers out in English as cardinal, ordinal, year, or currency words online, or parse number words back into digits.
---
## What does number-to-words conversion do?

This tool spells a number out in English words — "forty-two" instead of `42` — and also runs the
other way, parsing words like "forty-two" back into digits. It covers four styles that each read
differently in English: plain cardinal counts, ordinal positions ("forty-second"), calendar years
("nineteen eighty-four"), and money amounts ("forty-two dollars and fifty cents"), in both US and
British conventions.

## How it works

Set **direction** to `to-words` (default) or `to-number`, and **style** to pick which convention
governs the wording. Cardinal is the default:

```example
title: a number spelled out in words (cardinal, the default)
input: 42
params: {"direction": "to-words", "style": "cardinal"}
output: forty-two
```

```example
title: words parsed back into digits
input: forty-two
params: {"direction": "to-number", "style": "cardinal"}
output: 42
```

`ordinal` style spells out a position rather than a count — "first," "second," "forty-second" — built
by taking the cardinal form and swapping its last word for the matching ordinal:

```example
title: ordinal style spells out a position
input: 1
params: {"style": "ordinal"}
output: first
```

`year` style reads a number the way people actually say calendar years out loud — splitting into two
two-digit halves ("nineteen eighty-four") rather than reading it as one large cardinal number, with
special cases for round centuries ("nineteen hundred"), years like 1905 ("nineteen oh five"), and
2000–2009 ("two thousand five"); later years split again ("twenty twenty-four"):

```example
title: year style reads calendar years the way people say them
input: 1984
params: {"style": "year"}
output: nineteen eighty-four
```

`currency` style splits the value into major and minor units and names both, using dollars/cents by
default or pounds/pence when **locale** is `en-GB`:

```example
title: currency style names both major and minor units
input: 42.50
params: {"style": "currency"}
output: forty-two dollars and fifty cents
```

## Options

- **direction** — `to-words` (default) spells a number out; `to-number` parses words back into
  digits.
- **style** — `cardinal` (default, plain count), `ordinal` (position), `year` (calendar-year reading),
  or `currency` (major and minor units named separately).
- **locale** — `en-US` (default) or `en-GB`. Besides swapping dollars/cents for pounds/pence, `en-GB`
  inserts "and" before the tens and units ("one hundred **and** five", "one thousand **and** five")
  the way British English conventionally does, where American English omits it.
- **per line** — on by default; converts each line independently.

## Common uses

- Writing out an amount in words on a check, invoice, or legal document ("forty-two dollars and fifty
  cents").
- Generating spoken-form text for a voice interface or accessibility reader, where digits read poorly
  aloud.
- Parsing free-text number words from user input or a document back into a usable numeric value.
- Producing a calendar year in prose form for a caption, title, or generated sentence.

## Tips and pitfalls

`ordinal` and `year` both require a whole number — a fractional value under either style raises a
clear error, since "forty-two-and-a-halfth" and "nineteen eighty-four point one" are not meaningful
readings. Parsing is strict about trailing content: "ninety-nine cents banana" is rejected rather than
quietly read as "0.99," since anything after the recognized currency unit is more likely a typo or
unrelated text than something to ignore. Very large numbers stay exact past
`Number.MAX_SAFE_INTEGER` because the integer part is tracked as an arbitrary-precision value
internally, not a floating-point `number` — up to the largest scale word the tool knows, so anything
from 10²¹ (one thousand quintillion) upward is rejected as too large to spell out. For turning a number into a short suffix form ("42nd")
instead of full words, see [ordinalize](/util/ordinalize/); for Roman numerals instead of English
words, see [roman numerals](/util/roman_numerals/); for formatting digits with grouping or currency
symbols rather than spelling them out, see [number format](/util/number_format/).
