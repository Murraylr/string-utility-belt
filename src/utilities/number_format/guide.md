---
title: Number Format Online: Thousands, Percent, Currency
description: Format numbers online as grouped thousands, percentages, currency, scientific or engineering notation, using any locale and separator.
---
## What does number formatting cover?

Turning a raw number like `1234567.891` into something readable (`1,234,567.89`, `45.7%`,
`$1,234.50`) depends on more than just rounding: it depends on grouping, a chosen notation, and
often a locale's own conventions for where the decimal point and thousands separators go. For every
style except scientific and engineering notation, this tool wraps the JavaScript engine's built-in
`Intl.NumberFormat`, so it follows the same locale data (Unicode CLDR) that browsers use rather than a
hand-rolled approximation; those two notations are rendered by the tool itself.

## How it works

Set **style** to choose the notation, and **decimals** to control precision. The default, `thousands`,
groups digits and keeps up to the given number of decimal places:

```example
title: grouped thousands (the default style)
input: 1234567.891
params: {"style": "thousands", "decimals": 2}
output: 1,234,567.89
```

`percent` multiplies the value by 100 and appends a `%` sign, so `0.4567` (a fraction) becomes
"45.7%", the same convention `Intl.NumberFormat`'s percent style uses:

```example
title: percent style multiplies by 100
input: 0.4567
params: {"style": "percent", "decimals": 1}
output: 45.7%
```

`engineering` notation is like scientific notation but constrains the exponent to a multiple of three,
so the mantissa lines up with SI prefixes (kilo, mega, milli, …) instead of always sitting between 1
and 10:

```example
title: engineering notation keeps the exponent a multiple of three
input: 12345
params: {"style": "engineering", "decimals": 2}
output: 12.35e+3
```

`currency` renders the value with the symbol for **currency** (an ISO 4217 code) placed the way
**locale** writes it. The number of decimal places comes from **decimals** (default 2), not from the
currency, so set `decimals` to 0 for a currency with no minor unit such as JPY:

```example
title: currency style with the default locale and currency
input: 1234.5
params: {"style": "currency"}
output: $1,234.50
```

A custom **separator** overrides the locale's own thousands separator, and it forces grouping on even
for the `decimal` and `fixed` styles, which are otherwise ungrouped:

```example
title: a custom thousands separator
input: 1234567.891
params: {"style": "thousands", "separator": " "}
output: 1 234 567.89
```

Parsing is just as flexible as formatting: input may already carry grouping, a currency symbol, or a
trailing `%` (read as a fraction, so "12.5%" parses as 0.125), and the tool figures out which of `,`
or `.` is the decimal separator from context.

## Options

- **style**: `decimal` (plain, ungrouped), `thousands` (default, grouped), `scientific`,
  `engineering`, `percent`, `currency`, `compact` (`1.23M`-style), or `fixed` (always exactly
  **decimals** places, ungrouped by default).
- **decimals**: 0–20, default 2. `fixed`, `percent`, `currency`, `scientific` and `engineering`
  always show exactly this many decimal places (for the last two, after the mantissa's decimal
  point); `decimal`, `thousands` and `compact` show up to this many, dropping trailing zeros.
- **locale**: a BCP 47 locale tag (default `en-US`) that governs grouping symbols, decimal marks, and
  currency formatting.
- **currency**: an ISO 4217 code (default `USD`), used only by the `currency` style.
- **separator**: a custom thousands separator; overrides the locale's own and forces grouping on.
  It has no effect on `scientific` and `engineering`, which never group digits.
- **per line**: on by default; formats each line of input independently.

## Common uses

- Displaying a computed value (a price, a percentage, a large count) in a UI-ready form without
  writing formatting code.
- Converting a number to another locale's conventions, for example checking how a US-formatted price
  reads in German or Indian number grouping.
- Normalizing pasted numbers that carry currency symbols or thousands separators back to a plain
  decimal (`style: decimal`, rounded to at most **decimals** places) for further processing.
- Producing engineering-notation values for text that will be read alongside SI-prefixed units (kHz,
  MΩ, and so on).

## Tips and pitfalls

A malformed locale tag (`not a locale!!`) or currency code (`US`) fails with an error naming the
problem. Well-formed but unknown values do not: an unknown code such as `XYZ` is printed as the code
itself (`XYZ 1,234.50`), and a locale the engine has no data for falls back to its default locale, so
double-check the output when using an unusual tag. Engineering notation rounds the
exact decimal value at the position that ends up displayed, not a value that has already drifted
through ordinary floating-point multiplication. This matters at exact `...5` boundaries, where a naive
implementation can round the wrong way. Currency and some locales insert a non-breaking space rather
than an ordinary one between the amount and the symbol; that is intentional (it keeps the two from
wrapping onto separate lines) and not a rendering glitch. For converting a raw byte count rather than
an arbitrary number, see [humanize bytes](/util/bytes_humanize/); for spelling a number out in words
instead of formatting its digits, see [number ↔ words](/util/number_words/).
