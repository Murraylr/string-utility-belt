---
title: DEFLATE Compress Online: Raw or zlib-Wrapped Bytes
description: Compress text or bytes with DEFLATE online, choosing raw or zlib-wrapped output and a level from 0 (store) to 9 (smallest), with exact byte examples.
---
## What is DEFLATE?

DEFLATE is the compression algorithm behind gzip, zlib, PNG, and the entries inside a ZIP archive. It
combines LZ77 back-reference matching (replacing repeated runs of bytes with "copy N bytes from M
back") with Huffman coding (giving frequent byte values shorter codes), defined in
[RFC 1951](https://www.rfc-editor.org/rfc/rfc1951). On its own, a raw DEFLATE stream has no header,
no length field, and no checksum. It is just the compressed bits, so a decoder has to already know
where the stream starts and, if it wants to know it decompressed correctly, has nothing built in to
check that against.

That is why DEFLATE almost always shows up wrapped in something. **zlib** ([RFC
1950](https://www.rfc-editor.org/rfc/rfc1950)) adds a 2-byte header and a 4-byte Adler-32 checksum
around the same DEFLATE stream. This is what you get from Python's `zlib.compress`, Node's
`zlib.deflateSync`, and PDF's `FlateDecode` streams. **gzip** wraps it differently again, with its own
header and a CRC-32 trailer; that format has its own [gzip compress](/util/gzip_compress/) utility
here, since the two wrappers are not interchangeable.

## How it works

Set **format** to choose the wrapper: `zlib` (the default) adds the RFC 1950 header and Adler-32
trailer around the compressed data, and `raw` emits the bare DEFLATE stream with nothing around it.
Either one decompresses with [deflate decompress](/util/deflate_decompress/): its default `auto`
format recognizes the zlib header and treats anything without one as raw, or you can name the format
explicitly. The output is deterministic: the same input, format and level always give the same
bytes. The examples below match those bytes against a pattern only because their UTF-8 rendering is
full of unprintable characters; every byte is still pinned.

```example
title: zlib-wrapped compression
input: Hello, DEFLATE!
params: {"format": "zlib", "level": 6}
output-matches: ^bytes\[120, 156, 243, 72, 205, 201, 201, 215, 81, 112, 113, 117, 243, 113, 12, 113, 85, 04, 00, 37, 196, 04, 87\]\nhex: \[78, 9c, f3, 48, cd, c9, c9, d7, 51, 70, 71, 75, f3, 71, 0c, 71, 55, 04, 00, 25, c4, 04, 57\]
```

The `raw` format drops the 6 bytes of header (`78 9c` at level 6) and Adler-32 trailer that `zlib` adds, leaving
only the DEFLATE stream itself. That is useful inside a container format (like ZIP) that keeps its own length
and checksum elsewhere. Compare this with the example above: the same input gives the same middle
bytes, minus the first two and last four:

```example
title: the same bytes without the zlib wrapper
input: Hello, DEFLATE!
params: {"format": "raw"}
output-matches: ^bytes\[243, 72, 205, 201, 201, 215, 81, 112, 113, 117, 243, 113, 12, 113, 85, 04, 00\]\nhex: \[f3, 48, cd, c9, c9, d7, 51, 70, 71, 75, f3, 71, 0c, 71, 55, 04, 00\]
```

**level** controls the effort spent finding matches, from `0` (store the input as-is, no real
compression, just wrapped) to `9` (search hardest for the smallest output); the default is `6`, the
same balance zlib itself defaults to. Level 0 is not "no output". It still adds the wrapper, so tiny
or already-compressed input can come out *larger* than it went in:

```example
title: level 0 stores instead of compressing, so short input grows
input: hi
params: {"level": 0}
output-matches: ^bytes\[120, 01, 01, 02, 00, 253, 255, 104, 105, 01, 59, 00, 210\]\nhex: \[78, 01, 01, 02, 00, fd, ff, 68, 69, 01, 3b, 00, d2\]
```

Empty input produces empty output. No header is written for nothing to compress:

```example
title: empty input produces empty output
input:
output:
bytes[]
hex: []
```

## Options

- **format**: `zlib` (default) adds the RFC 1950 header and Adler-32 trailer; `raw` is the bare RFC
  1951 stream with neither.
- **level**: `0`–`9`, default `6`. Higher levels spend more effort searching for matches and usually
  produce smaller output, at the cost of more compute; `0` disables matching entirely and just stores
  the bytes with the wrapper attached.

## Common uses

- Producing a zlib stream for a protocol or file format that expects `FlateDecode`-style compression
  (PDF streams, some binary protocols, `Content-Encoding: deflate`).
- Building the raw DEFLATE payload that a ZIP entry stores internally, or the zlib stream that PNG
  keeps in its `IDAT` chunks.
- Comparing compression levels or wrapper overhead on a known input before choosing settings for a
  larger pipeline.
- Feeding [base64 encode](/util/base64_encode/) or [hex encode](/util/hex_encode/) afterwards to carry
  the compressed bytes as text.

## Tips and pitfalls

DEFLATE (in either wrapper) is not encryption. Anyone with the matching decoder can read the
original data back out immediately. It only reduces size. For genuinely small inputs, compression
overhead usually beats any savings from pattern matching, so do not be surprised when a two-word
string comes out larger than it went in; that overhead becomes negligible on larger, more repetitive
input, which is where DEFLATE pays off. If a downstream step or system expects gzip specifically
(recognizable by its own two-byte magic number in place of zlib's header), use
[gzip compress](/util/gzip_compress/) instead; the two wrappers are not interchangeable even though
they compress the same way underneath.
