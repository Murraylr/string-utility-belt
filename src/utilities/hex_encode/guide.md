---
title: Hex Encode Online: Text to Hexadecimal Converter
description: Convert text or bytes to a hexadecimal string online. Each byte becomes exactly two lowercase hex digits, with worked Unicode examples.
---
## What is hex encoding?

Hexadecimal (base 16) encoding writes each byte of data as exactly **two hex digits** (`0-9`, `a-f`), so every possible byte value from `00` to `ff` has a fixed, unambiguous two-character representation. It's the most direct, human-readable way to look at raw bytes, with no bit-shuffling or grouping across byte boundaries the way [base32 encode](/util/base32_encode/) or [base64 encode](/util/base64_encode/) do. That is why it's the usual format for color codes, hash digests, memory dumps, and MAC addresses.

## How it works

1. Text is converted to UTF-8 bytes first; raw bytes from a previous step (a file, [random bytes](/util/random_bytes/), [hex decode](/util/hex_decode/)) are used as-is.
2. Each byte, a number from 0 to 255, is written as two hex digits, left-padded with a `0` if it would otherwise be a single digit (so `10` decimal becomes `0a`, not `a`).
3. The digits are concatenated with no separator or spacing.

```example
title: each byte becomes two hex digits
input: Hi
output: 4869
```

```example
title: raw bytes encode directly, byte for byte
input-encoding: hex
input: deadbeef
output: deadbeef
```

### Unicode text

Because hex encoding works on bytes, any character outside plain ASCII first becomes multiple UTF-8 bytes, each of which is then written as two hex digits:

```example
title: a multi-byte UTF-8 character
input: ✓
output: e29c93
```

Empty input produces an empty string:

```example
title: empty input
input:
output:
```

## Common uses

- Reading and comparing hash digests, which are almost always shown in hex (see [hash](/util/hash/), [md5](/util/md5/), [sha3](/util/sha3/)).
- Representing binary keys, tokens, or checksums in logs, config files, and URLs where raw bytes wouldn't display safely.
- Debugging binary data. Pair this with [hex dump](/util/hex_dump/) when you also want an ASCII column and byte offsets alongside the hex.
- Colors, IP addresses in some notations, and low-level protocol fields that are conventionally written in hex.

## Tips and pitfalls

- Output is always exactly **twice the length** of the input in bytes, and always lowercase.
- Hex encoding is not compression or encryption. It makes data larger (2 characters per byte instead of 1) and hides nothing.
- To reverse it, use [hex decode](/util/hex_decode/), which also accepts uppercase hex digits even though this tool only emits lowercase.
- If you need bytes represented as groups of `0`/`1` instead, see [binary encode](/util/binary_encode/); for base-8 groups, see [octal encode](/util/octal_encode/).
