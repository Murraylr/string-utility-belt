---
title: Hex Decode Online: Hexadecimal to Bytes Converter
description: Decode a hexadecimal string to raw bytes online. Tolerates spaces between byte pairs and uppercase digits, with a byte-by-byte view of the result.
---
## What is hex decoding?

This reverses [hex encode](/util/hex_encode/): it reads a string of hexadecimal digits, two at a time, and turns each pair back into the byte it represents. Unlike several of the other decoders in this toolkit, this tool always produces **raw bytes** (there's no separate "output as text" switch), so the result is shown as the byte values, their hex form, and a best-effort UTF-8 reading of them, all at once.

## How it works

1. Whitespace in the input is ignored, so hex that's been formatted with spaces between bytes (a common style from hex dump tools) still decodes correctly.
2. The remaining characters must form pairs. An odd number of hex digits can't map onto whole bytes, so that's rejected.
3. Each two-character pair is parsed as one byte, 00 to ff, case-insensitively.

```example
title: spaces between byte pairs are ignored
input: 68 65 6c 6c 6f
output:
bytes[104, 101, 108, 108, 111]
hex: [68, 65, 6c, 6c, 6f]
utf8: hello
```

```example
title: uppercase digits work the same as lowercase
input: 4A4B
output:
bytes[74, 75]
hex: [4a, 4b]
utf8: JK
```

### Bytes that aren't valid text

The `utf8:` line is always an attempt, not a guarantee: when the decoded bytes don't happen to form valid UTF-8, that line still appears but shows mojibake (real characters mixed with the Unicode replacement character, �) rather than being left out. Treat the `bytes[...]` and `hex: [...]` values as the ground truth, and the `utf8:` line as a convenience that only means something when the source data actually was text.

Empty input decodes to zero bytes:

```example
title: empty input
input:
output: bytes[]
hex: []
```

## Common uses

- Turning a hash digest, key, or token you have in hex form back into raw bytes for a later step, such as [base64 encode](/util/base64_encode/) or [base32 encode](/util/base32_encode/).
- Reconstructing binary data pasted from a hex editor, protocol trace, or log line.
- Verifying that a value round-trips correctly through [hex encode](/util/hex_encode/).

## Tips and pitfalls

- This tool does **not** accept a `0x` prefix or non-hex separators like commas or colons, only hex digits and whitespace. Strip a `0x` prefix or replace other separators with spaces first if your source includes them.
- An odd number of hex digits is always an error: two digits make one byte, so a leftover single digit can't be decoded.
- If you need the result formatted as groups of `0`/`1` instead, see [binary decode](/util/binary_decode/); for base-8 groups, see [octal decode](/util/octal_decode/).
