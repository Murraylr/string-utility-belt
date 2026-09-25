---
title: Base32 Encode Online — Text to Base32 Converter
description: Encode text or bytes to Base32 online with the RFC 4648, extended-hex, or z-base-32 alphabet, plus worked examples of padding and grouping.
---
## What is Base32 encoding?

Base32 writes binary data using only **32 printable characters**, so the result is safe wherever a system only tolerates plain ASCII — the same problem [base64 encode](/util/base64_encode/) solves, but with a smaller, case-insensitive alphabet. The standard (RFC 4648) alphabet is `A–Z` plus the digits `2–7`, so it contains no `0` or `1` to confuse with the letters `O` and `I`/`L`. That makes Base32 a common choice for values a person might read aloud, type by hand, or store in a case-insensitive filesystem — most notably TOTP secret keys for authenticator apps.

Like all encodings, Base32 is not encryption: it hides nothing and anyone can reverse it with [base32 decode](/util/base32_decode/).

## How it works

Base32 works on **5 bits at a time**: each output character represents one of 32 possible values (2⁵ = 32), so 5 bytes (40 bits) become exactly 8 groups of 5 bits, encoded as 8 characters, which is why output length is always a multiple of 8 when padded.

1. Your text is converted to UTF-8 bytes first (raw bytes from a previous step are used as-is).
2. The bytes are treated as one long bit stream and sliced into 5-bit chunks, most significant bits first.
3. Each 5-bit chunk (0–31) is looked up in the chosen alphabet.

`hello` is 5 bytes — 40 bits exactly, which divides evenly into eight 5-bit groups, so no padding is needed:

```example
title: five bytes divide evenly into 5-bit groups
input: hello
output: NBSWY3DP
```

### Padding with `=`

When the input length is not a multiple of 5 bytes, the final group is short. The encoder fills the missing low bits with zeros and pads the output with `=` up to the next multiple of 8 characters:

```example
title: three bytes need padding to reach a multiple of 8
input: foo
output: MZXW6===
```

Padding is optional — turning it off just omits the trailing `=` characters; a decoder can still work out the byte count from the number of characters:

```example
title: padding off drops the trailing =
params: {"padding": false}
input: foo
output: MZXW6
```

### Choosing an alphabet

- **`rfc4648`** (default) — the standard alphabet described above.
- **`rfc4648-hex`** — RFC 4648 §7's "extended hex" alphabet (`0–9A–V`), whose encoded strings sort in the same order as the bytes they encode; DNSSEC's NSEC3 records use it.
- **`z-base-32`** — a lowercase, reshuffled alphabet designed for easier human reading and typing; conventionally used without padding.

```example
title: z-base-32 conventionally omits padding
params: {"variant": "z-base-32", "padding": false}
input: foobar
output: c3zs6aubqe
```

### Unicode and empty input

Text outside plain ASCII is encoded as its UTF-8 bytes, exactly like [base64 encode](/util/base64_encode/); an empty string or empty byte array produces empty output rather than an error.

```example
title: unicode text is encoded as utf-8 bytes first
input: café
output: MNQWNQ5J
```

## Options

- **variant** — `rfc4648` (default), `rfc4648-hex`, or `z-base-32`. Pick the alphabet that the system consuming the output expects; they are not interchangeable.
- **padding** — whether to add trailing `=` characters (default on). Turn it off for TOTP secrets and other contexts that don't need or want padding.

## Common uses

- TOTP/HOTP secret keys for two-factor authenticator apps (Google Authenticator, Authy), which are conventionally Base32 without padding.
- Case-insensitive identifiers, since the alphabet is unambiguous whether typed in upper or lower case.
- DNS labels and filesystem names that cannot safely contain `+`, `/`, or mixed case.
- Comparing encoding density against [base64 encode](/util/base64_encode/) (Base32 is 20% longer, but case-insensitive and free of `+` and `/`) or [hex encode](/util/hex_encode/) (2 characters per byte, even larger).

## Tips and pitfalls

- Base32 output is about **60% larger** than the input: 5 bytes always become 8 characters.
- The three variants are not interchangeable — encoding with `rfc4648-hex` and decoding with the default `rfc4648` variant produces garbage or an error.
- This is an encoding, not a secret. Anyone can run [base32 decode](/util/base32_decode/) on the output; do not use it to hide sensitive data.
- If you need the raw bytes back out instead of text, [base32 decode](/util/base32_decode/)'s output option switches between text and bytes.
