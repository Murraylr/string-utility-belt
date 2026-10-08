---
title: Base58 Decode Online: Base58 to Text Converter
description: Decode Base58 (Bitcoin, Ripple, or Flickr alphabet) back to text or raw bytes online, restoring leading zero bytes correctly.
---
## What is Base58 decoding?

This reverses [base58 encode](/util/base58_encode/): it takes a Base58 string (the kind of value you'd see in a Bitcoin address or a similarly compact identifier) and recovers the original text or bytes. Base58 treats the whole encoded string as one large number written in base 58, so decoding is a big-integer conversion, not a fixed-size bit regrouping like [base32 decode](/util/base32_decode/) or [base64 decode](/util/base64_decode/) use.

## How it works

1. Each character is looked up in the chosen alphabet to get its value 0–57.
2. The value is accumulated into one large integer: `result = result * 58 + digit`, left to right.
3. That integer is converted back to bytes.
4. The bytes are decoded as UTF-8 text, unless you ask for raw bytes.

```example
title: decode back to text
input: 2NEpo7TZRRrLZSi2U
output: Hello World!
```

Whitespace anywhere in the input (spaces, tabs, newlines) is stripped before decoding, which is convenient when a value has been wrapped across lines.

### Leading zero bytes

Because a leading zero byte adds no numeric value, the encoder represents each one as a leading copy of the alphabet's first character (`1` for Bitcoin) instead of folding it into the number. Decoding reverses that: each leading `1` becomes one restored `0x00` byte before the big-integer result is appended. For example, `11233QC4` decodes (with **output** set to `bytes`) to the six bytes `00 00 28 7f b4 cd`: two leading `1`s, two leading zero bytes. In text mode those zero bytes come back as invisible NUL characters, so use bytes output whenever the leading zeros matter, as they do for the version byte of a Bitcoin address.

### Choosing an alphabet

Set **alphabet** to match the encoder. Because `bitcoin`, `ripple`, and `flickr` share the same 58 characters in different positions, decoding with the wrong one never trips over an unknown character. It yields different bytes, which in text mode usually fail the UTF-8 check but can also come out as silently wrong output:

```example
title: the ripple alphabet decodes back to the same text
params: {"alphabet": "ripple"}
input: p4NFofTZRRiLZS5p7
output: Hello World!
```

### Getting raw bytes back

Set **output** to `bytes` whenever the original data wasn't text, or when you want to see exactly what was encoded, byte by byte:

```example
title: bytes output shows the decimal, hex, and text form together
params: {"output": "bytes"}
input: 2NEpo7TZRRrLZSi2U
output:
bytes[72, 101, 108, 108, 111, 32, 87, 111, 114, 108, 100, 33]
hex: [48, 65, 6c, 6c, 6f, 20, 57, 6f, 72, 6c, 64, 21]
utf8: Hello World!
```

## Options

- **alphabet**: `bitcoin` (default), `ripple`, or `flickr`. Must match the encoder.
- **output**: `text` (default) decodes the result as UTF-8; `bytes` returns the raw bytes untouched.

## Common uses

- Inspecting the raw bytes of a legacy Bitcoin address or other Base58 identifier with output set to `bytes` (for an address: version byte, payload and 4-byte checksum; the checksum itself is not verified here).
- Recovering the original value from a short, human-typed identifier.
- Round-tripping data through [base58 encode](/util/base58_encode/) in a pipeline, for comparison against [base62 decode](/util/base62_decode/) or [hex decode](/util/hex_decode/) of the same bytes.

## Tips and pitfalls

- Base58 is **case-sensitive**: `o` and `O` are different, and only `o` is in the alphabet, unlike case-insensitive [base32 decode](/util/base32_decode/).
- The characters `0`, `O`, `I`, and `l` never appear in valid Base58. If your input contains one, it's not Base58, or it's been corrupted.
- A "decoded bytes are not valid UTF-8" error means the original data was binary, not text; switch the output option to `bytes` instead.
- There is no built-in checksum here. A single wrong character produces different, silently wrong output rather than an error most of the time. Formats like real Bitcoin addresses add their own checksum on top of plain Base58.
