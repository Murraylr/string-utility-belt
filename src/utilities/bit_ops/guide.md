---
title: Bitwise Operations Online — AND, OR, XOR, Shift, Rotate
description: Run bitwise AND, OR, XOR, NOT, shifts, rotates, popcount or bit reversal on integers online at 8/16/32/64-bit width, in radix 2 to 36.
---
## What are bitwise operations?

Bitwise operations work on the individual binary digits of an integer rather than its value as a
whole — flipping bits, combining two numbers bit by bit, or sliding bits left and right within a fixed
width. They show up constantly in low-level code: packing flags into a byte, masking out part of a
value, implementing checksums and hashes, or working with binary protocols where every bit has a
defined meaning. This tool runs one operation at a time against a chosen bit width, so you can see
exactly what a given operation does to a given value without writing and running code for it.

## How it works

Pick an **operation**, a **width** (8, 16, 32 or 64 bits), and, for two-input operations, an
**operand**. The input value is read in **input radix** (0 auto-detects `0x`/`0b`/`0o` prefixes,
defaulting to decimal otherwise) and masked down to the chosen width before the operation runs, so a
64-bit value truncates to its low 8 bits if you ask for 8-bit width. The result is written back out in
**output radix**, zero-padded to the full width for radixes that are a power of two (binary, octal,
hex) so you can always see every bit.

```example
title: bitwise AND against a mask, shown in binary
input: 12
params: {"operation": "and", "operand": "10", "width": "8", "outputRadix": 2}
output: 00001000
```

Shift and rotate amounts are read as a plain decimal count, regardless of **input radix** —
`operand: "10"` means ten positions even when the input radix is 16 (only an explicit `0x`, `0b` or
`0o` prefix on the amount changes that). `rotate-left` and `rotate-right`
wrap bits around the chosen width instead of discarding them, which is what plain shifts do:

```example
title: rotate left by one bit, with auto-detected hex input
input: 0x80
params: {"operation": "rotate-left", "operand": "1", "width": "8", "outputRadix": 16}
output: 01
```

`popcount` (the number of set bits) is the exception to the width-padded output: it always reports a
plain decimal count, since "how many bits are set" has no natural width of its own:

```example
title: counting set bits with popcount
input: 255
params: {"operation": "popcount", "width": "8"}
output: 8
```

With **per line** left on (the default), each line of input — and each whitespace-separated value
within a line — is converted independently, so you can process a whole list of values in one step:

```example
title: converting two values per line
params: {"operation": "or", "operand": "0", "width": "8"}
input:
12
10
output:
00001100
00001010
```

## Options

- **operation** — `and`, `or`, `xor`, `not`, `shift-left`, `shift-right` (arithmetic, sign-extending),
  `unsigned-shift-right`, `rotate-left`, `rotate-right`, `popcount`, or `reverse-bits`.
- **operand** — the second value for `and`/`or`/`xor` (read in **input radix**), or the shift/rotate
  count (decimal unless prefixed). Unused by `not`, `popcount`, and `reverse-bits`, though it must
  still be a valid number.
- **width** — `8`, `16`, `32`, or `64` bits. Every value is masked to this width before the operation
  runs, and shift/rotate counts wrap or clamp to it.
- **input radix** — `0` (default) auto-detects a `0x`, `0b`, or `0o` prefix and otherwise reads
  decimal; set 2–36 to force a specific radix, in which case a matching prefix on the input is
  stripped, but one that only coincidentally looks like a prefix (`0b1a` in hex, since `b` is a valid
  hex digit) is read as an ordinary digit instead.
- **output radix** — 2–36, default 2 (binary). Power-of-two radixes are zero-padded to the full width.
- **per line** — on by default; processes each line, and each whitespace-separated token within it,
  separately. Turn it off to treat the whole input as one value.

## Common uses

- Working out what a bitmask or flag combination actually looks like before hardcoding it.
- Converting a value between hex and binary while also applying a mask or shift, in one step.
- Checking how sign-extension differs between `shift-right` (arithmetic) and
  `unsigned-shift-right` on a value with the high bit set.
- Counting set bits (`popcount`) for a Hamming-weight calculation, or reversing bit order
  (`reverse-bits`) for protocols that transmit least-significant-bit first.

## Tips and pitfalls

`shift-right` is arithmetic: it preserves the sign by extending the value's top bit, so shifting a
value with its high bit set right stays "negative" in that width instead of filling with zeros.
`unsigned-shift-right` always fills with zeros, matching most bitwise contexts where values are treated
as unsigned. If your input value does not fit the chosen radix — an `8` in a binary literal, or a
letter beyond what the input radix allows — the tool reports exactly which character is invalid and in
what radix, rather than silently truncating the string. For value conversions without bitwise
operations, see [number base convert](/util/number_base_convert/); for inspecting a floating-point
number's raw bits specifically, see [ieee 754 float bits](/util/ieee754/).
