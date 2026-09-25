---
title: Hex Dump Online — Hex and ASCII Byte Viewer
description: Render text or bytes as a hexdump -C style dump with an offset column, grouped hex bytes and an ASCII gutter, with a configurable row width.
---
## What is a hex dump?

A hex dump shows the raw bytes of some data as hexadecimal numbers, laid out in fixed-width rows alongside their printable ASCII equivalents. It is the standard way to inspect binary data — file headers, network captures, encoded output from another step — at the byte level, the job command-line tools like `xxd`, `hexdump` and `od` have done for decades. This tool produces the canonical layout of `hexdump -C` — offset, hex bytes grouped in eights, and a `|...|` ASCII column — for any text or bytes you give it.

## How it works

Each row starts with an 8-digit hexadecimal **offset** (the position of its first byte within the whole input), followed by the row's bytes as two-digit hex pairs, followed by an ASCII **gutter** showing each byte as a printable character or a `.` when it falls outside the printable ASCII range (0x20–0x7E).

```example
title: a short string at the default width
input: Hello
output: 00000000  48 65 6c 6c 6f                                    |Hello|
```

Bytes are grouped in eights, with an extra space inserted at each group boundary, which is why longer rows have a visible gap partway through the hex column:

```example
title: bytes are grouped by eight and rows wrap at the row width
input: aaaaaaaaaaaaaaaaaaaa
output:
00000000  61 61 61 61 61 61 61 61  61 61 61 61 61 61 61 61  |aaaaaaaaaaaaaaaa|
00000010  61 61 61 61                                       |aaaa|
```

The second row is short — only 4 of the 16 possible bytes — but its hex column is padded with blank space so it lines up exactly with the row above, keeping the `|` gutters aligned down the whole dump.

### Choosing a row width

The **bytes per row** option controls how many bytes each line shows, from 1 to 256.

```example
title: a narrower row width
params: {"width": 4}
input: Hello
output:
00000000  48 65 6c 6c  |Hell|
00000004  6f           |o|
```

### Formatting the hex and turning columns off

**uppercase hex** switches the hex digits (and the offset) to upper case:

```example
title: uppercase hex digits
params: {"width": 2, "uppercase": true}
input: ÿ
output: 00000000  C3 BF  |..|
```

`ÿ` is one character but two UTF-8 bytes (`C3 BF`), which is why a single accented letter still fills the whole two-byte row above.

**show offset** and **show ascii** can each be turned off independently, for a more compact dump:

```example
title: no offset column
params: {"width": 2, "showOffset": false}
input: Hi
output: 48 69  |Hi|
```

```example
title: no ascii gutter
params: {"width": 4, "showAscii": false}
input: Hi
output: 00000000  48 69
```

## Options

- **bytes per row** — how many bytes each row shows, from 1 to 256. Defaults to 16, the traditional `xxd`/`hexdump` width.
- **uppercase hex** — off by default (lower-case hex digits and offsets); on renders them in upper case.
- **show ascii** — on by default, adding the `|...|` printable-character gutter after the hex column. Turn it off for a hex-only dump.
- **show offset** — on by default, adding the leading 8-digit offset column. Turn it off when you only care about the bytes themselves.

## Common uses

- Inspecting the exact bytes produced by an earlier pipeline step — a hash, a compressed value, encoded bytes from [get bytes](/util/get_bytes/) or [charset encode](/util/charset_encode/) — instead of a flat decimal or hex list.
- Verifying a file's magic number or header bytes (for example, confirming a PNG starts with `89 50 4e 47`) at the very start of a dump.
- Comparing two binary values byte for byte when a simple text diff is not useful.
- Debugging encoding issues by seeing exactly which bytes an unexpected character produced, alongside [unicode inspect](/util/unicode_inspect/).

## Tips and pitfalls

- Text input is first converted to UTF-8 bytes before dumping, so multi-byte characters (accented letters, CJK text, emoji) always show as several hex bytes, never as a single "byte" — the `ÿ` example above is a common surprise for anyone expecting one byte per visible character.
- Only bytes 0x20–0x7E (printable ASCII) show through the gutter as themselves; everything else, including all non-ASCII bytes, becomes a `.`, so the gutter is only a rough guide for ASCII-heavy content.
- Empty input produces an empty result rather than a header row with no data.
- To go the other direction — turning hex digits back into bytes — use [get bytes](/util/get_bytes/) in `hex` mode or [hex decode](/util/hex_decode/); both ignore whitespace between pairs, but neither reads a full dump, so strip the offset and ASCII columns first.
