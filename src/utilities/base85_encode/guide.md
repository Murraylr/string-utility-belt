---
title: Base85 Encode Online: Ascii85 & Z85 Converter
description: Encode text or bytes as Base85 online using the Ascii85, Z85, or RFC 1924 alphabet, with the classic z shortcut and optional <~ ~> delimiters.
---
## What is Base85 encoding?

Base85 packs binary data more densely than [base64 encode](/util/base64_encode/): it uses 85 printable characters instead of 64, so every 4 bytes (32 bits) become exactly 5 characters (85⁵ is just over 2³², so 5 digits can represent every possible 32-bit value). That works out to roughly **25% larger** than the input, compared with Base64's 33%. Adobe uses this exact format (called Ascii85) inside PostScript and PDF files; ZeroMQ uses a different alphabet called Z85 for the same idea.

## How it works

1. Text is converted to UTF-8 bytes first; raw bytes are used as-is.
2. Bytes are grouped four at a time and read as one 32-bit big-endian number.
3. That number is converted to base 85, most significant digit first, producing exactly 5 characters looked up in the chosen alphabet.
4. A short final group (1–3 leftover bytes) is zero-padded to 4 bytes, encoded the same way, and then trimmed back down to `leftover + 1` characters.

```example
title: the classic Ascii85 reference sentence
input: Man is distinguished
output: 9jqo^BlbD-BleB1DJ+*+F(f,q
```

### The `<~ ~>` delimiters

Adobe's convention wraps Ascii85 data in `<~` and `~>` so a parser can find where the encoded block starts and ends inside a larger PostScript or PDF file. This tool leaves them off by default; turn **delimiters** on to add them:

```example
title: wrapping the same output in Adobe's delimiters
params: {"delimiters": true}
input: Man is distinguished
output: <~9jqo^BlbD-BleB1DJ+*+F(f,q~>
```

### The `z` shortcut

In the **ascii85** variant only, a complete 4-byte group of zero bytes (a common case in sparse binary data) collapses to a single `z` character instead of the usual 5. The group has to line up on a 4-byte boundary; zeros in a short final group are encoded normally. The Z85 and RFC 1924 alphabets don't get this shortcut, because `z` is an ordinary data character in both of them:

```example
title: four zero bytes collapse to a single z
input-encoding: hex
input: 0000000041
output: z5l
```

### Z85 and RFC 1924

**Z85** (ZeroMQ's alphabet, specified in ZeroMQ RFC 32) leaves out quotes, backslash and space so the output can sit inside source-code strings. Strict Z85 only defines input whose length is a multiple of 4 bytes; this tool also encodes other lengths using Ascii85's short-final-group rule, which strict Z85 implementations may reject. **RFC 1924** takes its alphabet from the April Fools' RFC that proposed writing IPv6 addresses in 20 characters; this variant uses only the alphabet with the same 4-byte grouping, which matches Python's `base64.b85encode` rather than RFC 1924's whole-address conversion:

```example
title: the ZeroMQ Z85 reference vector
params: {"variant": "z85"}
input-encoding: hex
input: 864fd26fb559f75b
output: HelloWorld
```

```example
title: rfc1924's alphabet on the same text
params: {"variant": "rfc1924"}
input: hello
output: Xk~0{Zv
```

## Options

- **variant**: `ascii85` (default, Adobe/PostScript), `z85` (ZeroMQ), or `rfc1924`. [base85 decode](/util/base85_decode/) needs the same one.
- **delimiters**: wraps the output in `<~ ~>` (default off). Only meaningful for `ascii85`-style consumers that expect Adobe's convention; leave it off for Z85 or RFC 1924 data.

## Common uses

- Embedding binary data inside PostScript or PDF files, following Adobe's original Ascii85 format.
- Encoding keys and short binary payloads for ZeroMQ (Z85), where the output must be safe inside C strings.
- Comparing encoding density against [base64 encode](/util/base64_encode/) (33% overhead) or [base91 encode](/util/base91_encode/) (denser still, around 23%).

## Tips and pitfalls

- The three variants share the general algorithm but not the alphabet. Encoding with `z85` and decoding with the default `ascii85` variant will fail or silently produce the wrong bytes.
- The `z` shortcut only applies to `ascii85`; don't expect a lone `z` in Z85 or RFC 1924 output to mean four zero bytes.
- This is an encoding, not encryption. It hides nothing and needs no key to reverse with [base85 decode](/util/base85_decode/).
