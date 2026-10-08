---
title: Base62 Encode Online: Text to Base62 Converter
description: Encode text or bytes as Base62 online using only 0-9, A-Z, and a-z: a compact, fully alphanumeric alternative to Base58 and Base64.
---
## What is Base62 encoding?

Base62 writes binary data using exactly the 62 alphanumeric characters (digits `0–9`, uppercase `A–Z`, and lowercase `a–z`) and nothing else. Unlike [base64 encode](/util/base64_encode/) or [base85 encode](/util/base85_encode/), it never produces `+`, `/`, `-`, `.`, or any other punctuation, which makes it a popular choice for short IDs and URL slugs that need to look clean and stay double-clickable without any escaping. It is denser than [base58 encode](/util/base58_encode/) (62 characters instead of 58) because it keeps the visually similar characters `0`/`O`, `I`/`l` that Base58 deliberately excludes.

Like Base58, Base62 is a big-integer encoding: it treats the whole input as one large number and re-expresses it in base 62, rather than slicing the data into fixed-size bit groups the way [base32 encode](/util/base32_encode/) and Base64 do.

## How it works

1. Your text is converted to UTF-8 bytes (raw bytes are used as-is).
2. The bytes are read as one big-endian integer.
3. That integer is repeatedly divided by 62; each remainder picks a character from the alphabet, assembled from least significant to most significant digit.

```example
title: bytes become one big number, re-expressed in base 62
input: hello
output: 7tQLFHz
```

### Leading zero bytes

A leading zero byte carries no numeric weight, so, exactly as in [base58 encode](/util/base58_encode/), each one is emitted separately as a leading `0` character rather than being folded into (and lost from) the big number:

```example
title: leading zero bytes become leading "0" characters
input-encoding: hex
input: 0000ff
output: 0047
```

### Choosing an alphabet

There is no single Base62 standard. The default **standard** alphabet is digits, then `A–Z`, then `a–z` (the order GMP uses for base 62). The **inverted** alphabet swaps the two letter runs (lowercase before uppercase) while using the same 62 characters, for compatibility with libraries that order the alphabet that way; encoding and decoding must agree on which one is used.

```example
title: the inverted alphabet swaps letter case order
params: {"alphabet": "inverted"}
input: hello
output: 7TqlfhZ
```

Empty input encodes to an empty string:

```example
title: empty input
input:
output:
```

## Options

- **alphabet**: `standard` (default: digits, then `A–Z`, then `a–z`) or `inverted` (digits, then `a–z`, then `A–Z`). [base62 decode](/util/base62_decode/) needs the same choice.

## Common uses

- URL shorteners and short, shareable IDs where every character must be plain alphanumeric.
- Turning raw ID bytes into a URL-safe string of at most 22 characters. For a UUID, get its 16 bytes by running its hex digits (dashes removed) through [hex decode](/util/hex_decode/) first. Encoding a UUID's 36-character text form instead makes it longer, not shorter.
- An alternative to [base58 encode](/util/base58_encode/) when a slightly denser encoding matters more than avoiding ambiguous characters, or to [hex encode](/util/hex_encode/) when two characters per byte is too long.

## Tips and pitfalls

- Other Base62 tools may use a different alphabet order, drop leading zero bytes, or encode a number rather than bytes, so their output often won't match this tool's. Check what the other side expects.
- Base62 output has **no fixed length** for a given input size. Leading zero bytes aside, the exact length depends on the numeric value of the data, not just its byte count.
- Base62 strings of different lengths don't sort into numeric order the way zero-padded decimal digits do; don't rely on lexical (string) sort to reflect the underlying numeric value.
- This is an encoding, not encryption or compression. The output is not smaller than a tightly packed binary representation, and it hides nothing.
- To get the original bytes back, use [base62 decode](/util/base62_decode/) with the matching alphabet.
