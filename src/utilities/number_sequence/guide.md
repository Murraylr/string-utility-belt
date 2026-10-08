---
title: Number Sequence Generator: Custom Ranges Online
description: Generate a numeric sequence online from a start, end and step, with any radix, zero padding, a prefix or suffix, and a custom separator.
---
## What is a number sequence generator?

A number sequence generator produces a list of numbers from a start value to an end value by a fixed step. It is the same idea as the Unix `seq` command (the end value is included, unlike Python's `range()`), but with extra formatting built in: a radix other than base 10, zero-padded digit widths, a prefix or suffix on every value, and a choice of separator. It ignores its text input entirely; every value comes from the parameters.

## How it works

The simplest case counts up by one:

```example
title: a simple range
input:
params: {"start": 1, "end": 5, "step": 1}
output: 1
2
3
4
5
```

Padding, a radix, and a prefix combine to produce fixed-width formatted values. This is useful for generating hex constants or IDs with a consistent digit count:

```example
title: zero-padded hex values with a prefix
input:
params: {"start": 0, "end": 3, "step": 1, "radix": 16, "pad": 2, "prefix": "0x"}
output: 0x00
0x01
0x02
0x03
```

A negative step counts down instead of up, as long as it actually moves toward `end`:

```example
title: counting down with a negative step
input:
params: {"start": 10, "end": 1, "step": -3}
output: 10
7
4
1
```

Fractional steps stay exact rather than accumulating floating-point drift. The decimal places shown are derived from `start` and `step`'s own precision, so a `0.25` step always prints two decimal places:

```example
title: a fractional step with a space separator
input:
params: {"start": 0, "end": 1, "step": 0.25, "separator": " "}
output: 0.00 0.25 0.50 0.75 1.00
```

Padding applies only to the digits, not the sign, so negative numbers keep their minus sign outside the padded width:

```example
title: padding negative numbers keeps the sign outside the width
input:
params: {"start": -2, "end": 2, "pad": 3, "separator": " "}
output: -002 -001 000 001 002
```

## Options

- **start / end / step**: the range to generate; both endpoints default to `1` and `10` with a step of `1`. The sequence always stops at or before `end` and never overshoots it, even when the step does not divide the span evenly (for example, `start: 1, end: 10, step: 4` stops at `9`, not `13`). The step must move toward `end`. A positive step with `end` below `start`, or vice versa, is rejected rather than silently producing an empty or infinite sequence.
- **zero pad width**: pads each value's digits (not its sign or prefix/suffix) to at least this many characters with leading zeros; default `0` (no padding). For fractional values the width includes the decimal point and decimals. A width narrower than a value's natural digit count never truncates it.
- **prefix / suffix**: literal text added before and after every value; both default to empty.
- **separator**: what joins the values; default `\n` (typed as the literal two characters `\n` in the field, since a plain text box cannot hold an actual newline; `\t` and `\r` follow the same convention).
- **radix**: the base to print numbers in, from 2 to 36; default `10`. Any radix other than 10 requires every value in the sequence to be a whole number, so a fractional step under a non-decimal radix is rejected.

## Common uses

- Generating a run of sequential test IDs, filenames, or line numbers with consistent zero-padding.
- Producing a lookup table of values in hex, octal, or binary for documentation or code comments.
- Generating column headers or index labels (`item-001`, `item-002`, …) for spreadsheets or fixtures, similar to what [template expand](/util/template_expand/)'s `{i}` token does inside a larger pattern.

## Tips and pitfalls

- This tool ignores its input entirely. The input box has no effect on the generated sequence.
- The sequence length is capped at 100,000 values; a very large span with a very small step throws a clear error instead of silently truncating or hanging.
- To zero-pad a value you already have (rather than generating a whole sequence), use [pad](/util/pad/) directly; to convert a single number between bases, use [number base convert](/util/number_base_convert/).
- Decimal precision is derived automatically from whichever of `start` or `step` has more decimal places, so mixing something like `start: 0` with `step: 0.1` still prints one decimal place consistently across the whole sequence rather than drifting after a few steps.
