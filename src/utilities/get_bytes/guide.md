---
title: Get Bytes Online: Convert Text to UTF-8 or Hex Bytes
description: Convert text into raw bytes using UTF-8 encoding, parsed hex pairs, or big-endian 16-bit code units, and view the result as decimal, hex and UTF-8.
---
## What does this tool do?

This tool turns a text string into raw bytes, which is the representation most binary-oriented steps in a pipeline actually operate on: hashing, compression, [hex dump](/util/hex_dump/), or a custom byte-level transform. Four modes control how the conversion happens, chosen with the **mode** option.

## How each mode works

**utf8** (the default) encodes the input the same way almost every modern text format does: each character becomes one to four bytes of standard UTF-8.

```example
title: utf8 mode encodes text as UTF-8 bytes
params: {"mode": "utf8"}
input: Hi
output:
bytes[72, 105]
hex: [48, 69]
utf8: Hi
```

**hex** goes the other way: it treats the input as a string of hex digit pairs (all whitespace is ignored) and parses it back into the bytes those pairs represent. This is useful when you already have bytes written out as hex (from another tool, a spec, or a hex dump) and need to turn them into an actual byte value for a pipeline.

```example
title: hex mode parses hex pairs into bytes
params: {"mode": "hex"}
input: 48 69
output:
bytes[72, 105]
hex: [48, 69]
utf8: Hi
```

Hex input must have an even number of hex digits once whitespace is stripped. An odd-length string like `abc` has no valid last byte and is rejected. Only the characters `0-9`, `a-f` and `A-F` are accepted, so a `0x` prefix or `:` separators must be removed first.

**base64** decodes Base64 text into the bytes it encodes. It is handy when binary data arrives Base64-encoded (from an API, a config file or a data URI) and the next step needs the raw bytes. Whitespace, including line breaks, is ignored, so wrapped Base64 works as-is. It uses the standard alphabet with `+` and `/`; for URL-safe input with `-` and `_`, use [base64url decode](/util/base64url_decode/) first.

```example
title: base64 mode decodes Base64 into bytes
params: {"mode": "base64"}
input: SGk=
output:
bytes[72, 105]
hex: [48, 69]
utf8: Hi
```

**unicode** encodes each UTF-16 code unit of the input as two bytes, high byte first, the same layout as big-endian UTF-16. This is a lower-level view than utf8 mode: astral characters (outside the Basic Multilingual Plane, like most emoji) are written as their surrogate pair (two code units and therefore four bytes), which is exactly how UTF-16BE stores them. Unlike a real UTF-16 encoder, it also writes an unpaired surrogate as-is instead of rejecting it.

```example
title: unicode mode writes each code unit as two big-endian bytes
params: {"mode": "unicode"}
input: 你
output:
bytes[79, 96]
hex: [4f, 60]
utf8: O`
```

The bytes above are the big-endian UTF-16 representation of `你` (U+4F60). Reading them back as UTF-8 (the `utf8:` line) produces unrelated ASCII characters, which is expected: this is a raw UTF-16 byte layout, not UTF-8, so it should only be decoded with a UTF-16-aware tool such as [charset decode](/util/charset_decode/) using `utf-16be`.

```example
title: empty input produces zero bytes
params: {"mode": "utf8"}
input:
output:
bytes[]
hex: []
```

## Options

- **Mode**: `utf8` (default), `hex`, `base64` or `unicode`, as described above.

## Common uses

- Preparing text as raw bytes before a hashing, compression or checksum step that only accepts bytes.
- Converting hex-encoded test fixtures or spec examples into actual byte values for a pipeline.
- Inspecting exactly which bytes a string of text corresponds to, alongside [hex dump](/util/hex_dump/) or [unicode inspect](/util/unicode_inspect/).
- Producing a big-endian UTF-16 byte layout for protocols or file formats that expect it; for well-formed text this matches [charset encode](/util/charset_encode/) with `utf-16be`.

## Tips and pitfalls

- `hex` mode is strict: any character outside `0-9a-fA-F` in a pair, or a leftover odd digit at the end, is rejected rather than silently ignored or padded.
- `unicode` mode is a fixed big-endian, two-bytes-per-code-unit layout. It does not offer a little-endian option or byte-order-mark handling. For more charset choices, including UTF-16LE and legacy single-byte charsets, use [charset encode](/util/charset_encode/) instead.
- To turn bytes back into readable text, use [charset decode](/util/charset_decode/), which supports UTF-8, UTF-16 and a range of legacy charsets.
- All whitespace in `hex` mode input is stripped before parsing, so `48 69`, `4869` and even `4 869` behave identically.
