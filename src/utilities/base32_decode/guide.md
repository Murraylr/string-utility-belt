---
title: Base32 Decode Online — Base32 to Text Converter
description: Decode Base32 (RFC 4648, extended-hex, or z-base-32) back to text or raw bytes online, tolerating case, missing padding, and whitespace.
---
## What is Base32 decoding?

This reverses [base32 encode](/util/base32_encode/): it turns a Base32 string back into the original text or raw bytes. Base32 packs data into 5-bit groups drawn from a 32-character alphabet, so decoding reads the string back into 5-bit chunks and reassembles them into 8-bit bytes.

## How it works

1. Whitespace and `=` padding characters are stripped, and the remaining characters are looked up in the chosen alphabet — case-insensitively, so `NBSWY3DP` and `nbswy3dp` decode identically.
2. Each character contributes 5 bits to a running bit stream.
3. Every full 8 bits collected becomes one output byte.
4. The bytes are decoded as UTF-8 text, unless you ask for raw bytes instead.

```example
title: decode back to text
input: NBSWY3DP
output: hello
```

Padding is optional on the way in: a string with its trailing `=` characters removed decodes the same as the padded form, and embedded whitespace (spaces, tabs, newlines) is ignored, which is convenient when Base32 has been wrapped across lines.

```example
title: missing padding and mixed case both work
input: mzxw6YTBOI
output: foobar
```

### Choosing an alphabet and output type

Pick the same **variant** the data was encoded with (`rfc4648`, `rfc4648-hex`, or `z-base-32`) — decoding with the wrong one usually throws (on a character that alphabet lacks, a non-canonical ending, or invalid UTF-8), but it can occasionally "succeed" with the wrong bytes:

```example
title: z-base-32 needs the matching variant
params: {"variant": "z-base-32"}
input: pb1sa5dx
output: hello
```

Set **output** to `bytes` to skip the UTF-8 step entirely, which is required whenever the underlying data was never text — a TOTP shared secret, a hash, a compressed blob. The result then shows the byte values in decimal and hex, plus the text they'd form if you did decode them:

```example
title: raw bytes, shown as decimal, hex, and text together
params: {"output": "bytes"}
input: MFRGG===
output:
bytes[97, 98, 99]
hex: [61, 62, 63]
utf8: abc
```

## Options

- **variant** — `rfc4648` (default), `rfc4648-hex`, or `z-base-32`. Must match how the value was encoded.
- **output** — `text` (default) decodes the bytes as UTF-8; `bytes` returns them untouched, which is the only safe choice when the original data was not text.

## Common uses

- Reading back TOTP/HOTP secret keys entered or scanned from an authenticator app.
- Verifying or debugging any system that stores identifiers or tokens as Base32.
- Round-tripping data produced by [base32 encode](/util/base32_encode/) in a pipeline, for example after [hash](/util/hash/) or [random bytes](/util/random_bytes/).

## Tips and pitfalls

- **Not every string of the right length is valid Base32.** A character count (after removing padding and whitespace) that leaves a remainder of 1, 3 or 6 when divided by 8 can never come from real 5-bit groups, so it is rejected rather than silently truncated.
- **Unused bits in the last character must be zero.** Base32's last character often carries a few padding bits alongside real data; if those bits are non-zero the input is not the canonical output of any encoder, and this tool rejects it rather than guess. A single mistyped character near the end is the usual cause.
- If decoding throws "not valid UTF-8", the original data was binary, not text — switch the output option to `bytes`.
- This is an encoding, not encryption: Base32 hides nothing, and decoding requires no key or password.
