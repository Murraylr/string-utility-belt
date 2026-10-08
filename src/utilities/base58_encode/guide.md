---
title: Base58 Encode Online: Text to Base58 Converter
description: Encode text or bytes as Base58 online with the Bitcoin, Ripple, or Flickr alphabet, avoiding ambiguous characters like 0, O, I, and l.
---
## What is Base58 encoding?

Base58 is the encoding behind classic (non-SegWit) Bitcoin addresses and similar identifiers: it writes binary data using 58 characters chosen specifically to avoid the visually ambiguous ones. Compared with Base64's 64-character alphabet, Base58 drops `0` (zero), `O` (capital o), `I` (capital i), and `l` (lowercase L), plus the non-alphanumeric `+` and `/`. That makes the result safe to read aloud, hand-copy, or double-click to select in full, which matters for values people actually type. A wallet address or a short link is useless if a `0`/`O` typo is easy to make and hard to notice.

Unlike [base32 encode](/util/base32_encode/) or [base64 encode](/util/base64_encode/), Base58 does not slice bits into fixed-size groups. It treats the whole input as one large number and re-expresses that number in base 58, which it has to do because 58 is not a power of two, so characters cannot map onto a whole number of bits.

## How it works

1. Your text is converted to UTF-8 bytes (raw bytes are used as-is).
2. The bytes are read as one big-endian integer.
3. That integer is repeatedly divided by 58; each remainder selects one character from the alphabet, built up from least significant to most significant.

```example
title: bytes become one big number, re-expressed in base 58
input: hello world
output: StV1DL6CwTryKyV
```

### Leading zero bytes

A leading zero byte carries no numeric weight (`0x00` and `0x0000` represent the same integer), so a plain big-integer conversion would silently drop them and make the encoding impossible to reverse correctly. To prevent that, each leading zero byte is instead emitted as a leading copy of the alphabet's first character (`1` in the Bitcoin alphabet), one for one:

```example
title: two leading zero bytes become two leading "1" characters
input-encoding: hex
input: 0000010203
output: 11Ldp
```

### Choosing an alphabet

The three built-in alphabets contain the same 58 characters rearranged: **Bitcoin** (the default, used by Bitcoin and IPFS), **Ripple** (used for XRP Ledger addresses), and **Flickr** (which puts the lowercase letters before the uppercase ones, the reverse of Bitcoin's order). Encoding and decoding must use the same alphabet. The same bytes produce different-looking output in each:

```example
title: the ripple alphabet reorders the same 58 characters
params: {"alphabet": "ripple"}
input: Hello World!
output: p4NFofTZRRiLZS5p7
```

Empty input encodes to an empty string:

```example
title: empty input
input:
output:
```

## Options

- **alphabet**: `bitcoin` (default), `ripple`, or `flickr`. Pick whichever the receiving system expects; [base58 decode](/util/base58_decode/) needs the matching one.

## Common uses

- Seeing how Base58 identifiers such as legacy Bitcoin addresses and IPFS CIDv0 hashes (`Qm…`) are built. A real address also needs a version byte and a Base58Check checksum, which this tool does not add.
- Short, human-typable identifiers where `0`/`O` or `I`/`l` confusion would cause real support problems.
- Compact representations of hashes or keys that still need to be readable and copy-pasteable, as an alternative to [base32 encode](/util/base32_encode/) (longer at 8 characters per 5 bytes, but case-insensitive) or [base62 encode](/util/base62_encode/) (denser, but keeps the ambiguous characters).

## Tips and pitfalls

- Base58 is case-sensitive, unlike Base32. Mixing up case when decoding will fail or produce the wrong value.
- This is an encoding, not encryption or a checksum. Unlike the Bitcoin address format that layers a checksum on top, plain Base58 encode/decode has no built-in error detection: a single mistyped character can decode to different, silently wrong bytes instead of an error.
- To get the original bytes back, use [base58 decode](/util/base58_decode/) with the same alphabet you encoded with.
