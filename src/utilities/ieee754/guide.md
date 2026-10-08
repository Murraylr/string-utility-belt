---
title: IEEE 754 Float Converter: Number to Bits and Back
description: Convert a number to its IEEE 754 sign, exponent and mantissa bits online, or decode bits back to a number, in double or single precision.
---
## What is IEEE 754?

IEEE 754 is the standard almost every programming language uses to store non-integer numbers in
memory: JavaScript's `number`, a C `double`, and Python's `float` are all IEEE 754 double precision
underneath. It represents a value as three fields packed into a fixed number of bits (a sign bit, a
biased exponent, and a mantissa, the significant digits), which lets it cover an enormous range of
magnitudes with a fixed amount of storage, at the cost of being unable to represent most decimal
fractions exactly. This tool converts a number to those raw bits, or decodes raw bits back to the
number they represent, so you can see exactly what a language's floating-point type is actually
storing.

## How it works

Set **direction** to `to-bits` (default) or `to-number`, and **precision** to `double` (64 bits, the
default: JavaScript's `number`, Python's `float`, C's `double`) or `single` (32 bits, C's `float`). The **format** option controls how bits are shown or read: `hex` is the packed bits as a
hex integer, `binary` is the bits grouped as sign / exponent / mantissa, and `breakdown` (default)
returns every field individually as JSON.

```example
title: a number to its packed hex bit pattern
input: 1.5
params: {"direction": "to-bits", "format": "hex"}
output: 0x3ff8000000000000
```

```example
title: hex bits back to the number they represent
input: 0x3ff8000000000000
params: {"direction": "to-number", "format": "hex"}
output: 1.5
```

`breakdown` format is the most detailed view: it splits the bit pattern into its sign, exponent, and
mantissa fields, reports the value's classification (`normal`, `subnormal`, `zero`, `infinity`, or
`nan`), and, critically, whether the stored value is **exactly** what you typed. Most decimal
fractions are not: `0.1` cannot be represented exactly in binary floating point, so the field
`isExact` is `false` and `exactValue` shows the true decimal value actually stored, out to full
precision:

```example
title: 0.1 cannot be stored exactly; the breakdown shows what really is
input: 0.1
params: {"direction": "to-bits", "precision": "single", "format": "breakdown"}
output:
{
  "precision": "single",
  "classification": "normal",
  "value": 0.10000000149011612,
  "sign": {
    "bit": 0,
    "symbol": "+"
  },
  "exponent": {
    "bits": "01111011",
    "raw": 123,
    "bias": 127,
    "unbiased": -4
  },
  "mantissa": {
    "bits": "10011001100110011001101",
    "raw": "5033165",
    "hex": "4ccccd",
    "fraction": 0.6000000238418579,
    "significand": 1.600000023841858
  },
  "bits": "00111101110011001100110011001101",
  "hex": "0x3dcccccd",
  "exactValue": "0.100000001490116119384765625",
  "ulp": 7.450580596923828e-9,
  "isExact": false,
  "nearestDouble": 0.1
}
```

`ulp` ("unit in the last place") is the gap to the next representable value at that magnitude. It is useful
for judging how much precision a given number actually has left. `nearestDouble` is your input read at
double precision, which is how you tell whether a single-precision rounding actually changed
anything: here it prints `0.1`, the closest double to what you typed, while `value` shows the coarser
single-precision result.

## Options

- **direction**: `to-bits` (default) encodes a number into its bit pattern; `to-number` decodes a bit
  pattern back into a number.
- **precision**: `double` (default, 64-bit) or `single` (32-bit).
- **format**: `breakdown` (default, full JSON detail), `hex` (packed bits as hex), or `binary` (bits
  grouped as sign / exponent / mantissa). On `to-number`, `format` also hints how to read an ambiguous
  bit pattern that could be read as either binary or hex digits.

## Common uses

- Debugging why two floating-point values that "should" be equal are not, by comparing their exact
  stored bits.
- Understanding a float's binary representation for a networking protocol, file format, or embedded
  system that transmits raw IEEE 754 bytes.
- Checking whether a decimal literal is stored exactly, or teaching how floating-point rounding works
  with a concrete example.
- Cross-checking values against [number base convert](/util/number_base_convert/) or
  [bit operations](/util/bit_ops/) when working with raw binary data alongside floating point.

## Tips and pitfalls

`NaN`, `Infinity`, and `-Infinity` are accepted as input (including the Unicode `∞` symbol) and encode
to their standard bit patterns; note that many different bit patterns decode to `NaN`, but this tool
always encodes `NaN` to one quiet-NaN pattern (`0x7ff8000000000000` in double precision). Decoding a
bit pattern that is too long for the chosen precision (for example, a 64-bit hex string decoded as
`single`) fails with a clear "too many bits" error rather than silently truncating it. A pattern that
is too short is not an error: it is padded with leading zeros, so `0x3f` decoded as `double` is a
tiny subnormal number, not 1.0 or 0.5. When a bit pattern could be read as either binary
digits or hex digits (like `1010`), the **format** option breaks the tie; an explicit `0x` or `0b`
prefix always wins over that hint when the digits actually match the prefix. Comparing floats for
exact equality is rarely what you want in real code. `isExact` here answers a narrower, useful
question: not "are two floats equal" but "does this specific bit pattern represent this specific
decimal number exactly."
