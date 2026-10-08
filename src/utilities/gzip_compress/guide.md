---
title: Gzip Compress Online: Create a .gz Stream from Text
description: Compress text or bytes into a gzip stream online, at a level from 0 (store) to 9 (smallest), with deterministic output and exact byte examples.
---
## What is gzip?

Gzip ([RFC 1952](https://www.rfc-editor.org/rfc/rfc1952)) is the compression format behind `.gz`
files and the `Content-Encoding: gzip` header that makes most web traffic smaller in transit. Inside,
it is the same DEFLATE algorithm as [deflate compress](/util/deflate_compress/) (LZ77 back-references
plus Huffman coding), but wrapped in its own header (10 bytes, plus optional fields such as a file
name, which this tool never writes) and an 8-byte trailer holding a CRC-32 checksum and the
uncompressed size. That wrapper is what makes gzip streams self-contained and recognizable
by their `1f 8b` magic bytes, unlike a bare DEFLATE stream or even a zlib-wrapped one.

## How it works

Compression only needs one real decision: **level**, from `0` to `9`, default `6` (the same default
zlib itself uses). Higher levels search harder for repeated patterns and usually produce smaller
output at the cost of more work; `0` disables that search and just stores the input with the gzip
wrapper attached, which is faster but rarely smaller.

```example
title: compress to a gzip stream
input: Hello, gzip!
params: {"level": 6}
output-matches: ^bytes\[31, 139, 08, 00, 00, 00, 00, 00, 00, 03, 243, 72, 205, 201, 201, 215, 81, 72, 175, 202, 44, 80, 04, 00, 62, 61, 15, 16, 12, 00, 00, 00\]\nhex: \[1f, 8b, 08, 00, 00, 00, 00, 00, 00, 03, f3, 48, cd, c9, c9, d7, 51, 48, af, ca, 2c, 50, 04, 00, 3e, 3d, 0f, 10, 0c, 00, 00, 00\]
```

The first two bytes, `1f 8b`, are gzip's fixed magic number; the third, `08`, means "DEFLATE" (the
only compression method gzip ever defines). After a flags byte come four bytes (offsets 4–7) that
normally hold a modification timestamp, but this tool always writes zero there, so compressing the
same input twice produces byte-for-byte identical output. That is useful when you want to diff two
compressed artifacts and care only about their content, not when they were made. (The examples match
the output against a pattern only because the UTF-8 rendering of these bytes is unprintable; every
byte is still pinned.)

Level `0` skips real compression and just stores the bytes, wrapper included, so very short input can
come out larger than it went in:

```example
title: level 0 stores rather than compresses
input: hi
params: {"level": 0}
output-matches: ^bytes\[31, 139, 08, 00, 00, 00, 00, 00, 04, 03, 01, 02, 00, 253, 255, 104, 105, 172, 42, 147, 216, 02, 00, 00, 00\]\nhex: \[1f, 8b, 08, 00, 00, 00, 00, 00, 04, 03, 01, 02, 00, fd, ff, 68, 69, ac, 2a, 93, d8, 02, 00, 00, 00\]
```

Empty input produces empty output, not a 20-byte header for nothing:

```example
title: empty input produces empty output
input:
output:
bytes[]
hex: []
```

## Options

The only setting is **level**, `0`–`9` (default `6`). `0` stores the input with minimal CPU cost; `9`
spends the most effort searching for matches in exchange for the smallest output. Values in between
trade one for the other; for most text, the gains above the default `6` are small.

## Common uses

- Producing a real `.gz` file or a gzip-encoded HTTP body to test decompression elsewhere.
- Shrinking a large text payload (logs, JSON exports, CSV data) before storing or transmitting it.
- Comparing how much a particular input actually compresses at different levels before committing to
  one in a larger system.
- Feeding the result into [base64 encode](/util/base64_encode/) or [hex encode](/util/hex_encode/) to
  carry compressed bytes as text, for example in a JSON field or a URL.

## Tips and pitfalls

Gzip is compression, not encryption. The output carries no secrecy at all, and anyone with a gzip
decoder (including [gzip decompress](/util/gzip_decompress/) right here) can recover the original
bytes instantly. Very short or already-compressed input (an image, a video, previously gzipped data)
typically grows slightly under gzip, because the 18 bytes of header and trailer outweigh anything the
compressor can find to shrink; that overhead only pays for itself once the input has real repetition
to exploit. If you need the same compressed data without gzip's own header and trailer (for example
to embed inside another format that tracks length and checksum itself), use
[deflate compress](/util/deflate_compress/) with the `raw` format instead, since gzip and raw DEFLATE
are not interchangeable even though they share the same underlying algorithm.
