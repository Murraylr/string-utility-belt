---
title: Base64 Encode Online: Convert Text to Base64
description: Free online Base64 encoder. Convert text or raw bytes to Base64 in your browser, and learn exactly how Base64 works with step-by-step examples.
---
## What is Base64 encoding?

Base64 is a way of writing **any binary data using only 64 safe, printable characters**: `A–Z`, `a–z`, `0–9`, `+` and `/`, with `=` used for padding. It exists because many systems were built to carry text (email via MIME, JSON, XML, URLs, HTTP headers, config files), and they can mangle or reject raw bytes such as `0x00` or invalid UTF-8. Encoding those bytes as Base64 turns them into plain ASCII that survives any text channel, and [base64 decode](/util/base64_decode/) turns them back into exactly the same bytes.

Base64 is an *encoding*, not encryption: anyone can reverse it, and it hides nothing. Its job is safe transport, not secrecy.

## How the encoder works

Base64 works on groups of **3 bytes (24 bits)** at a time and writes each group as **4 characters of 6 bits each** (2⁶ = 64, hence the name):

1. Your text is first converted to bytes using UTF-8. Raw bytes (from a file, or from a previous step such as a hash or gzip) are used as they are.
2. The bytes are taken three at a time and their 24 bits are laid side by side.
3. The 24 bits are cut into four 6-bit numbers, each between 0 and 63.
4. Each number is looked up in the Base64 alphabet: 0–25 are `A–Z`, 26–51 are `a–z`, 52–61 are `0–9`, 62 is `+` and 63 is `/`.

Take the word `Man`. Its bytes are 77, 97 and 110, or in binary `01001101 01100001 01101110`. Regrouped into sixes that is `010011 010110 000101 101110` = 19, 22, 5, 46, which the alphabet maps to `T`, `W`, `F`, `u`:

```example
title: three bytes become four characters
input: Man
output: TWFu
```

### Padding with `=`

When the input length is not a multiple of three, the last group is short. The encoder fills the missing bits with zeros and adds `=` for each missing byte, so the output length is always a multiple of four: one leftover byte gives two characters plus `==`, two leftover bytes give three characters plus `=`.

```example
title: one leftover byte is padded with ==
input: M
output: TQ==
```

```example
title: two leftover bytes are padded with =
input: Ma
output: TWE=
```

### Unicode text is encoded as UTF-8 first

Base64 encodes bytes, not characters, so every character outside plain ASCII becomes several bytes before it is encoded. `é` is two UTF-8 bytes (`C3 A9`) and most emoji are four. The browser's built-in `btoa()` gets this wrong: it throws on any character above U+00FF (such as `€` or 😀), and silently encodes `é` as the single Latin-1 byte `E9` (`6Q==`) instead of UTF-8 (`w6k=`). This tool always encodes the UTF-8 bytes, which is what almost every other language and API expects.

```example
title: accented and emoji characters
input: café 😀
output: Y2Fmw6kg8J+YgA==
```

### Binary input

When the input is already bytes (a file you dropped in, or the output of a step such as gzip compress or a hash), those exact bytes are encoded without any text conversion. Here are the five bytes `48 65 6c 6c 6f` given as hex:

```example
title: raw bytes (hex input)
input-encoding: hex
input: 48 65 6c 6c 6f
output: SGVsbG8=
```

## Output format

- The result is a single line with **no line breaks**. MIME email bodies traditionally wrap Base64 at 76 characters, and PEM files at 64; if you need that, add a [word wrap](/util/word_wrap/) step after this one.
- The standard alphabet uses `+` and `/`, which have special meanings in URLs and file names. For tokens, JWTs and anything that goes into a URL, use [base64url encode](/util/base64url_encode/) instead, which swaps them for `-` and `_` and drops the padding.
- Base64 output is always about **33% larger** than the input: every 3 bytes become 4 characters. A 30 KB image becomes roughly 40 KB of text.

## Common uses

- Embedding images or fonts directly in HTML or CSS as `data:` URIs (see [data URI build](/util/data_uri_build/)).
- Sending binary attachments or non-ASCII text through email (MIME) and older text protocols.
- HTTP Basic authentication, where `user:password` is sent as Base64 in the `Authorization` header.
- Storing binary values (keys, hashes, certificates, small files) inside JSON, YAML or environment variables.
- Reading the header and payload of a JWT, which are Base64url-encoded JSON.

## Tips and pitfalls

- **Base64 is not security.** Never use it to "hide" passwords or API keys; decoding takes one click.
- If a decoder elsewhere produces garbled accents, it is probably decoding the bytes as Latin-1 instead of UTF-8.
- Whitespace or line breaks inside your input are data and get encoded too. Use [trim](/util/trim/) first if a trailing newline sneaks in from copy-paste.
- To compare against other encodings of the same bytes, try [hex encode](/util/hex_encode/) (2 characters per byte) or [base32 encode](/util/base32_encode/) (case-insensitive, 60% larger).
