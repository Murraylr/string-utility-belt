---
title: Base62 Decode Online: Base62 to Text Converter
description: Decode Base62 (0-9, A-Z, a-z) back to text or raw bytes online, restoring leading zero bytes and supporting the inverted alphabet.
---
## What is Base62 decoding?

This reverses [base62 encode](/util/base62_encode/): it takes a purely alphanumeric Base62 string and recovers the original text or bytes. Because Base62 encodes by treating the whole input as one large number, decoding is a big-integer conversion rather than a fixed-size bit regrouping.

## How it works

1. Each character is looked up in the chosen alphabet for its value, 0–61.
2. The values accumulate into one large integer: `result = result * 62 + digit`, left to right.
3. The integer is converted back into bytes.
4. The bytes are decoded as UTF-8 text, unless you ask for raw bytes.

```example
title: decode back to text
input: 5TP3P3v
output: Hello
```

Whitespace anywhere in the input is stripped before decoding, so a value that has been wrapped across lines or padded with stray spaces still decodes correctly:

```example
title: embedded whitespace is stripped before decoding
input: 1wJfr zvdbt XUOlUjUf
output: Hello, World!
```

### Leading zero bytes

Each leading `0` character in the input becomes one restored `0x00` byte, before the big-integer result is appended. This is the exact inverse of how the encoder emits them. For example, `0047` decodes (with **output** set to `bytes`) to the three bytes `00 00 ff`: two leading `0`s, two leading zero bytes. In text mode those zero bytes would come back as invisible NUL characters, so use bytes output when they matter.

### Matching the alphabet

Set **alphabet** to `inverted` if the value was encoded with the inverted (lowercase-before-uppercase) alphabet. Both alphabets contain the same 62 characters, so decoding with the wrong one never fails on an unknown character. It produces different bytes, which in text mode usually fail the UTF-8 check but can also come out as silently wrong text:

```example
title: decoding with the inverted alphabet
params: {"alphabet": "inverted"}
input: 5tp3p3V
output: Hello
```

## Options

- **alphabet**: `standard` (default) or `inverted`. Must match how the value was encoded.
- **output**: `text` (default) decodes the bytes as UTF-8; `bytes` returns them untouched.

## Common uses

- Recovering the bytes or text behind a Base62 string made by [base62 encode](/util/base62_encode/) or a compatible byte-oriented encoder. Many URL shorteners instead encode an integer ID; this tool returns that as raw bytes, not a decimal number.
- Verifying that a Base62-encoded value round-trips correctly through [base62 encode](/util/base62_encode/).
- Comparing the same bytes across encodings, alongside [base58 decode](/util/base58_decode/) or [hex decode](/util/hex_decode/).

## Tips and pitfalls

- Base62 is **case-sensitive**: `a` and `A` are different characters and occupy different positions in the alphabet.
- A "decoded bytes are not valid UTF-8" error means the original data was binary, not text. Switch the output option to `bytes`.
- There is no checksum built in: a mistyped character produces different, silently wrong output rather than an error in most cases, so verify important values independently.
