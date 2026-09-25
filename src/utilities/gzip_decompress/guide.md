---
title: Gzip Decompress Online — Decode .gz Data to Text
description: Decompress a gzip stream online to text or bytes, with multi-member and CRC-32 support, plus automatic hex or Base64 transport detection.
---
## What is gzip decompression?

Gzip ([RFC 1952](https://www.rfc-editor.org/rfc/rfc1952)) wraps a DEFLATE-compressed stream in a
header of at least 10 bytes (starting with the magic bytes `1f 8b`, optionally followed by fields such
as the original file name) and an 8-byte trailer holding a CRC-32
checksum and the uncompressed size. This tool reads that wrapper, decompresses the DEFLATE data
inside, and hands back the original bytes — pairing with [gzip compress](/util/gzip_compress/), which
produces the streams it reads.

## How it works

Paste in gzip bytes, and the tool inflates them and checks the CRC-32 trailer against what actually
came out, catching corruption that a plain inflate would otherwise decompress into silently wrong
data:

```example
title: decompress a gzip stream to text
input-encoding: hex
input: 1f8b0800000000000003f348cdc9c9d75148afca2c5004003e3d0f100c000000
params: {"output": "text"}
output: Hello, gzip!
```

Gzip data often travels as text rather than raw bytes — copied from a browser's dev tools, logged as a
string, or embedded in JSON — so this tool also accepts a hex string, a Base64 string, or a "binary
string" (one byte per character code) typed directly as input, and works out which one it is:

```example
title: a base64-encoded gzip stream needs no separate decode step
input: H4sIAAAAAAACCvNIzcnJ11FIr8osUAQAPj0PEAwAAAA=
output: Hello, gzip!
```

RFC 1952 defines a gzip file as a series of members, so several gzip streams can sit back to back in
one file — this is why `cat a.gz b.gz > both.gz` produces a file that `gunzip` decompresses to the two
inputs joined together. Not every decoder handles that; this one walks
every member rather than stopping after the first one, so nothing at the end of a concatenated file is
silently dropped:

```example
title: every member of a concatenated gzip file is decoded, not just the first
input: H4sIAAAAAAACCitILCpRyM9L1VEAAOs9/SMKAAAAH4sIAAAAAAAACitILCpRKCnPBwAnH7LgCAAAAA==
output: part one, part two
```

## Options

The only setting is **output** — `text` (default) decodes the recovered bytes as UTF-8; `bytes`
returns them untouched, which you need whenever the payload inside is not text at all (an image, a
font, another compressed format).

## Common uses

- Reading a downloaded or logged `.gz` payload back into text without a separate command-line tool.
- Verifying that a [gzip compress](/util/gzip_compress/) step elsewhere in a pipeline produced the
  exact bytes you expect.
- Decoding a gzip-compressed HTTP response body that was captured or copied as hex or Base64 text.
- Recovering data from a multi-member gzip file, such as one grown by appending new members
  (`gzip -c more.log >> all.gz`) instead of rewriting it.

## Tips and pitfalls

If the CRC-32 or size in the trailer does not match the decompressed data, this tool throws a "gzip
integrity check failed" error rather than returning corrupted output — treat that as a sign the source
bytes were truncated or altered somewhere along the way, not a bug in the decoder. Trailing bytes after
a complete, well-formed member are rejected too — even trailing zero padding, which `gunzip` only
warns about — so a file with garbage appended after valid gzip data will not decode as if nothing were
wrong. If the recovered bytes are not valid UTF-8 and `output` is
left at `text`, the tool throws instead of emitting mangled characters; switch to `bytes` for binary
payloads. And if the input turns out to be zlib or raw DEFLATE data instead of gzip — no `1f 8b` magic
number at the front — use [deflate decompress](/util/deflate_decompress/) instead, since the two
wrappers are laid out differently even though both compress with the same underlying algorithm.
