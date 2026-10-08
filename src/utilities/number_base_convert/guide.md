---
title: Number Base Converter: Hex, Binary, Octal, Base 2–36
description: Convert whole numbers between any base from 2 to 36 online, with 0x/0b/0o auto-detection, digit grouping, and exact BigInt precision.
---
## What is a number base?

A number base (or radix) is the count of distinct digits a positional number system uses before it
carries over to the next place. Decimal uses 10 digits, binary uses 2 (`0`, `1`), hexadecimal uses 16
(`0`–`9` then `a`–`f`), and so on up to base 36, which uses `0`–`9` plus every letter from `a` to `z`.
The same quantity can be written in any of these; converting between them is a routine but easy to get
wrong by hand once negative numbers, prefixes, or very large values are involved.

## How it works

Set **from base** (2–36, default 10; or 0 to auto-detect a `0x`, `0b`, or `0o` prefix, otherwise
assuming decimal) and **to base** (2–36, default 16), and the tool re-renders the number in the target
base:

```example
title: decimal to hexadecimal (the defaults)
input: 255
params: {"from": 10, "to": 16}
output: ff
```

With **from base** set to `0`, a recognized prefix on the input decides the source base for you, so
you do not have to know or declare it up front:

```example
title: auto-detecting a 0x-prefixed hex value
input: 0xff
params: {"from": 0, "to": 2}
output: 11111111
```

**group digits** inserts a space every N digits, counted from the right. It is the natural way to read a
long binary or hex value, similar to how a decimal number groups into thousands:

```example
title: grouping binary digits in fours (nibbles)
input: 255
params: {"from": 10, "to": 2, "groupDigits": 4}
output: 1111 1111
```

Every conversion runs on an arbitrary-precision integer internally, so values far beyond what a 64-bit
number can hold convert exactly, with no rounding or precision loss:

```example
title: exact conversion of a number larger than any built-in integer type
input: 123456789012345678901234567890
params: {"from": 10, "to": 16}
output: 18ee90ff6c373e0ee4e3f0ad2
```

## Options

- **from base**: 2–36, default 10; `0` auto-detects `0x`/`0b`/`0o`, otherwise decimal. With the
  default of 10, a prefixed value like `0xff` is rejected (`x` is not a decimal digit), so set 16 or 0.
  A prefix that matches the declared base is stripped; one that does not (like `0b1` when `from` is
  16) is read as an ordinary digit sequence instead, since `b` is itself a valid hex digit.
- **to base**: 2–36, default 16.
- **uppercase**: renders letter digits (`a`–`z`) as uppercase. Off by default.
- **prefix**: prepends `0x`, `0b`, or `0o` to the output for bases 16, 2, and 8; other bases have no
  conventional prefix and get none even with this on.
- **group digits**: inserts a space every N digits from the right; `0` (default) disables grouping.
  Grouped input is also accepted back: spaces, commas, and underscores between digits are ignored
  when parsing.
- **per line**: on by default; converts each line of input separately.

## Common uses

- Converting a color, memory address, or bit flag between hex and binary while debugging.
- Turning a decimal ID or timestamp into a shorter representation (base 36, for example) for a URL or
  code.
- Checking a value written with a `0x`/`0b`/`0o` prefix in source code against its decimal equivalent.
- Working with numbers too large for a 64-bit integer type, where exactness matters more than speed.

## Tips and pitfalls

Only whole numbers are supported. A decimal point in the input is rejected outright, since a fraction
that ends neatly in one base (0.1 in decimal) can repeat forever in another (binary). Negative numbers
keep a leading minus sign (`-255` becomes `-ff`); there is no two's-complement output. A digit that is not
valid in the declared base (a `2` under `from base: 2`, or a `g` in hex) produces an error naming the
exact character and radix, rather than silently ignoring it or misreading it as a different base. For
converting a Roman numeral instead of a positional number base, see
[roman numerals](/util/roman_numerals/); for bitwise operations on the underlying bits rather than
just re-rendering the digits, see [bit operations](/util/bit_ops/); for the raw bits behind a
floating-point number specifically, see [ieee 754 float bits](/util/ieee754/).
