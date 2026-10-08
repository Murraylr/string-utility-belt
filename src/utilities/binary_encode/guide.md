---
title: Binary Encode Online: Text to Binary (0s and 1s)
description: Convert text or bytes to binary online. Each byte becomes 8 (or 7) bits of 0s and 1s, with a custom separator and configurable byte grouping.
---
## What is binary encoding?

This writes each byte of your data as a string of `0`s and `1`s (the literal bit pattern of the byte), which is the most direct way to see exactly what a computer stores, one bit at a time. Where [hex encode](/util/hex_encode/) groups bits into 4-bit nibbles and [octal encode](/util/octal_encode/) groups them into 3-bit digits, this tool shows every single bit, which is why it's the format of choice for teaching binary arithmetic, bitwise operations, or debugging a protocol at the bit level.

## How it works

1. Text is converted to UTF-8 bytes first; raw bytes from a previous step are used as-is.
2. Each byte (0–255) is written as 8 binary digits, most significant bit first, left-padded with `0`s to a fixed width.
3. The groups are joined with a separator, optionally combining more than one byte per group.

```example
title: each byte becomes 8 bits
input: Hi
output: 01001000 01101001
```

### Unicode text

Because encoding works on UTF-8 bytes, a character outside plain ASCII becomes more than one 8-bit group: an accented letter is 2 bytes, and most emoji are 4:

```example
title: an emoji is four utf-8 bytes, so four groups
input: 😀
output: 11110000 10011111 10011000 10000000
```

### 7-bit groups

Switching **bits per byte** to 7 drops the leading bit of every byte, producing 7-character groups instead of 8. This only works for bytes 0–127 (plain ASCII); a byte of 128 or higher doesn't fit in 7 bits and raises an error rather than silently losing data:

```example
title: 7-bit groups for plain ascii
params: {"bits": "7"}
input: Hi
output: 1001000 1101001
```

### Separator and grouping

The **separator** can be any string, including escape sequences like `\n` and `\t` typed literally into the field, and **bytes per group** controls how many bytes sit between separators before the next one. Setting bytes per group to `0` removes separators entirely, producing one unbroken run of bits:

```example
title: no separator at all
params: {"separator": "", "groupBytes": 0}
input: Hi
output: 0100100001101001
```

```example
title: two bytes per group
params: {"groupBytes": 2}
input: Hi!
output: 0100100001101001 00100001
```

Empty input produces an empty string:

```example
title: empty input
input:
output:
```

## Options

- **bits per byte**: `8` (default) or `7`. Use `7` only for plain ASCII input; anything with a byte ≥ 128 will throw.
- **separator**: the text between groups (default a single space). Supports `\n`, `\t`, `\r`, `\0`, and `\\` typed literally; leave it empty for no separator.
- **bytes per group**: how many bytes sit between separators (default `1`). `0` means no separator at all, regardless of the separator field.

## Common uses

- Teaching or reviewing binary number representation and bitwise operations.
- Debugging a protocol or file format at the individual-bit level.
- Comparing the same bytes against [hex encode](/util/hex_encode/) (4 bits per digit) or [octal encode](/util/octal_encode/) (3 bits per digit) for a denser view of the same data.

## Tips and pitfalls

- Output has **4 times as many digits** as the equivalent [hex encode](/util/hex_encode/) output (3.5 times with 7-bit groups), not counting separators. Binary is the least compact of this toolkit's byte-to-text formats.
- With 7-bit groups, a byte of 128 or higher throws an error naming the offending byte in hex, rather than truncating it to something that looks plausible but is wrong.
- To reverse this, use [binary decode](/util/binary_decode/), which tolerates most separators and even a `0b` prefix on each group.
