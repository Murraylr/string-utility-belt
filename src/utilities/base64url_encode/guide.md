---
title: Base64URL Encode Online: URL-Safe Base64 Converter
description: Encode text or bytes as URL-safe Base64 (RFC 4648 §5) online, using - and _ instead of + and /, with optional = padding.
---
## What is Base64url encoding?

Base64url is the URL- and filename-safe variant of [base64 encode](/util/base64_encode/), defined in RFC 4648 §5. Standard Base64 uses `+` and `/`, both of which have special meaning inside a URL (and `/` inside a file path), so pasting raw Base64 into a query string or a filename risks breaking it. Base64url swaps those two characters for `-` and `_`, which are safe in both contexts, and conventionally drops the `=` padding since URL and JSON contexts rarely need it. This is the encoding used for all three segments of a [JWT](/util/jwt_decode/): header, payload and signature.

## How it works

The core algorithm is identical to standard Base64 (3 bytes, or 24 bits, become 4 characters of 6 bits each). Only the alphabet's last two symbols differ:

1. Text is converted to UTF-8 bytes first; raw bytes are used as-is.
2. Every 3 bytes become 4 characters, each looked up in the URL-safe alphabet (`A–Z`, `a–z`, `0–9`, `-`, `_`).
3. By default, no `=` padding is added, so the output length is not necessarily a multiple of four.

```example
title: no = padding by default
input: hello world
output: aGVsbG8gd29ybGQ
```

### Where `-` and `_` actually show up

The substitution only matters for the two 6-bit values (62 and 63) that standard Base64 renders as `+` and `/`, so most output looks identical to regular Base64. Bytes whose top bits land on those values are where the difference is visible:

```example
title: high bytes land on the - and _ characters
input-encoding: hex
input: fbff
output: -_8
```

```example
title: an emoji encodes with a - in the output
input: 🎉
output: 8J-OiQ
```

### Optional padding

Padding is off by default, matching how Base64url is used in JWTs and most URL contexts. Turn it on if the system on the other end expects a length that's always a multiple of four:

```example
title: turning padding back on
params: {"padding": true}
input: a
output: YQ==
```

## Options

- **padding**: whether to add trailing `=` characters (default off). [base64url decode](/util/base64url_decode/) accepts the value either way, so leave this off unless something downstream specifically requires padding.

## Common uses

- Encoding the header and payload segments of a JWT (see [JWT decode](/util/jwt_decode/)).
- Putting binary data (tokens, keys, short IDs) directly into a URL path or query string without percent-encoding.
- Any context where standard Base64's `+`, `/`, and `=` would need escaping, such as filenames or cookie values.

## Tips and pitfalls

- Output containing `-` or `_` is rejected by [base64 decode](/util/base64_decode/), which only recognizes `+` and `/`. Use [base64url decode](/util/base64url_decode/), which accepts both alphabets.
- Base64url is not encryption or a signature. Decoding a JWT's payload (see [JWT decode](/util/jwt_decode/)) reveals its contents to anyone, with no verification that it hasn't been tampered with.
- Output is still about **33% larger** than the input, the same overhead as standard Base64. Only the character set changes, not the density.
