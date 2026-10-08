---
title: Octal Decode Online: Octal to Text Converter
description: Decode octal (base-8) byte values back to text or raw bytes online, tolerating backslash escapes, 0o prefixes, and any separator.
---
## What is octal decoding?

This reverses [octal encode](/util/octal_encode/): it reads a series of base-8 numbers (each representing one byte, `0` to `377` in octal, 0–255 in decimal) and turns them back into text or raw bytes. Every value must fit in one byte, so a Unix permission like `755` is rejected as too large. To convert numbers between bases, use [number base convert](/util/number_base_convert/).

## How it works

1. Backslashes and `0o` prefixes are stripped, since both are common ways octal values get written (`\150`, `0o150`, or plain `150` all mean the same thing).
2. Any character that isn't a letter or a digit (a space, comma, dash, backslash, and so on) separates one group from the next, and no separator is needed at all when each group is exactly 3 digits. A letter, or the digit `8` or `9`, is an error rather than a separator.
3. Each group of 1–3 digits is parsed as one byte, 0 to 255 (a longer run that's an exact multiple of 3 is first split into triples); a value above `377` (255 in decimal) is rejected as too large for one byte.
4. The bytes are decoded as UTF-8 text, unless you ask for raw bytes.

```example
title: space-separated triples
input: 110 151
output: Hi
```

### Tolerant of escapes and missing separators

Because [octal encode](/util/octal_encode/)'s own separator is a free-form field, this decoder accepts backslash escapes, `0o` prefixes, and even triples run together with no separator at all:

```example
title: backslash escapes work like plain triples
input: \110\151
output: Hi
```

```example
title: unseparated triples still split correctly
input: 110151
output: Hi
```

### Unicode text

```example
title: a multi-byte utf-8 character
input: 303 251
output: é
```

### Raw bytes

```example
title: a value that isn't valid text, shown byte by byte
params: {"output": "bytes"}
input: 377
output: bytes[255]
hex: [ff]
utf8: �
```

## Options

- **output**: `text` (default) decodes the bytes as UTF-8; `bytes` returns them untouched.

## Common uses

- Decoding octal escape sequences (`\150\151`) from C, shell, or Python strings back into readable text, as long as the string is nothing but escapes, since literal letters mixed in are rejected.
- Recovering bytes from an octal byte listing, such as the byte columns of `od -b` output (with the offset column removed).
- Round-tripping data through [octal encode](/util/octal_encode/), for comparison against [hex decode](/util/hex_decode/) or [binary decode](/util/binary_decode/) of the same bytes.

## Tips and pitfalls

- A group longer than 3 digits must be an exact multiple of 3 (two triples run together, for example); anything else is rejected rather than guessed at.
- A value above `377` (255 in decimal) can never be one byte and is always an error.
- The `utf8:` line shown for bytes output is a best-effort reading, not a guarantee. Bytes that aren't valid UTF-8 show the Unicode replacement character (�) there instead of real text; trust the `bytes[...]` and `hex: [...]` values as the source of truth.
- If decoding throws "not valid UTF-8" in text mode, switch the output option to `bytes`.
