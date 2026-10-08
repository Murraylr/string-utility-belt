---
title: Binary Decode Online: Binary to Text Converter
description: Decode a string of 0s and 1s back to text or raw bytes online, ignoring whitespace, punctuation, and 0b prefixes, with 7- or 8-bit groups.
---
## What is binary decoding?

This reverses [binary encode](/util/binary_encode/): it reads a string made of `0`s and `1`s and turns each fixed-width group back into the byte it represents. It's useful whenever you have data written out bit by bit (from a textbook exercise, a protocol dump, or a previous pipeline step) and need the actual bytes or text back.

## How it works

1. Anything that isn't a `0`, `1`, letter, or digit is treated as a separator and stripped: spaces, commas, dashes, arrows, even em dashes all work. An optional `0b` prefix on a group is also removed.
2. The remaining digits must be only `0` and `1`, and their total count must be a multiple of the group width (8, or 7 in 7-bit mode); anything else is rejected rather than guessed at.
3. Each group of digits is parsed as one byte.
4. The bytes are decoded as UTF-8 text, unless you ask for raw bytes.

```example
title: decode 8-bit groups back to text
input: 01001000 01101001
output: Hi
```

### Tolerant of separators and `0b` prefixes

Because [binary encode](/util/binary_encode/)'s separator field is free-form, this decoder doesn't rely on a fixed punctuation whitelist. It strips **any** non-alphanumeric character between groups, plus a leading `0b` on each group:

```example
title: mixed punctuation and a 0b prefix both work
input: 0b0100-1000,0110.1001
output: Hi
```

### 7-bit groups

Set **bits per byte** to `7` to decode groups that were encoded without the leading zero bit, matching whatever [binary encode](/util/binary_encode/) produced with the same setting:

```example
title: 7-bit groups
params: {"bits": "7"}
input: 1001000 1101001
output: Hi
```

### Raw bytes

```example
title: bytes output shows the decimal, hex, and text form together
params: {"output": "bytes"}
input: 01001000 01101001
output: bytes[72, 105]
hex: [48, 69]
utf8: Hi
```

## Options

- **bits per byte**: `8` (default) or `7`. Must match how the value was encoded.
- **output**: `text` (default) decodes the bytes as UTF-8; `bytes` returns them untouched, which is required whenever the original data wasn't text.

## Common uses

- Converting a binary string from a textbook, homework problem, or online puzzle back into readable text.
- Reconstructing bytes from a protocol trace or log that records data bit by bit.
- Round-tripping data through [binary encode](/util/binary_encode/) in a pipeline, for comparison against [hex decode](/util/hex_decode/) or [octal decode](/util/octal_decode/) of the same bytes.

## Tips and pitfalls

- A letter or a stray digit outside `0`/`1` inside the input (`2`, `x`, an accented letter) is treated as invalid data and rejected, not silently skipped like a separator would be.
- The total digit count must divide evenly by the group width; a truncated or extra bit at the end is an error, not a guess.
- If decoding throws "not valid UTF-8", the original data was binary, not text. Switch the output option to `bytes`.
