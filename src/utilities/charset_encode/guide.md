---
title: Charset Encode Online: Text to Windows-1252, Latin-1 Bytes
description: Encode text to raw bytes in UTF-8, UTF-16LE/BE or a legacy single-byte charset like windows-1252 or ISO-8859-1, with control over unmappable characters.
---
## What is a charset encoder?

A charset defines how text characters map to bytes. Modern software mostly uses UTF-8 or UTF-16, but a lot of older systems, file formats and protocols still expect a legacy single-byte charset such as `windows-1252` (the legacy "ANSI" code page of Western-European Windows installs) or `iso-8859-1` (Latin-1, common in older European email and web content). This tool converts text into the exact bytes one of those charsets would produce, which is useful for testing decoders, reproducing legacy file formats, or preparing bytes for [charset decode](/util/charset_decode/) to read back.

## How it works

The **charset** option picks the target: `utf-8` (default), `utf-16le`, `utf-16be`, `windows-1252`, `iso-8859-1` or `iso-8859-15` (Latin-9). The encoder walks the input one Unicode code point at a time (never splitting a surrogate pair) and converts each one:

- For `utf-8`, `utf-16le` and `utf-16be`, every code point is representable except a lone (unpaired) surrogate, which cannot exist as valid text in the first place.
- For the single-byte charsets, each code point is looked up in a table built from the charset's own byte-to-character mapping. `iso-8859-1` is a pure 1:1 mapping of bytes 0–255 to the same code points. `iso-8859-15` is identical except for eight bytes reassigned to characters like `€`, `Š` and `Ž`. `windows-1252` reassigns the C1 control range (0x80–0x9F) to punctuation and symbols such as curly quotes, the em dash and `€`. Not every one of those 32 slots is used, and the five that are not fall back to their original control-character code point so the mapping stays reversible.

```example
title: UTF-8 is the default
input: café
output:
bytes[99, 97, 102, 195, 169]
hex: [63, 61, 66, c3, a9]
utf8: café
```

```example
title: Latin-1 keeps one byte per character, where possible
params: {"charset": "iso-8859-1"}
input: café
output:
bytes[99, 97, 102, 233]
hex: [63, 61, 66, e9]
utf8: caf�
```

The Latin-1 example above shows `é` correctly encoded as the single byte `0xE9`. The garbled `utf8:` line at the end is not a bug in this tool. It is what you get when those Latin-1 bytes are re-decoded as UTF-8 for display, which is exactly the kind of mismatch this tool exists to demonstrate.

```example
title: windows-1252 has its own high byte range
params: {"charset": "windows-1252"}
input: café€
output:
bytes[99, 97, 102, 233, 128]
hex: [63, 61, 66, e9, 80]
utf8: caf�
```

### What happens to characters the charset can't represent

Single-byte charsets can only hold 256 characters total, so most of Unicode has no representation in them. The **unmappable characters** option decides what happens when the input contains one:

- `error` (the default) throws, naming the code point, for example `U+20AC cannot be encoded in iso-8859-1`.
- `skip` silently drops the character.
- `replace` substitutes `?` for a single-byte charset, or the Unicode replacement character (U+FFFD) for UTF-8/UTF-16.

```example
title: skip drops unmappable characters
params: {"charset": "iso-8859-1", "onUnmappable": "skip"}
input: a€b
output:
bytes[97, 98]
hex: [61, 62]
utf8: ab
```

```example
title: replace substitutes a placeholder instead
params: {"charset": "iso-8859-1", "onUnmappable": "replace"}
input: a€b
output:
bytes[97, 63, 98]
hex: [61, 3f, 62]
utf8: a?b
```

## Options

- **charset**: the target encoding: `utf-8` (default), `utf-16le`, `utf-16be`, `windows-1252`, `iso-8859-1` or `iso-8859-15`.
- **unmappable characters**: `error` (default), `skip` or `replace`, as described above.

## Common uses

- Reproducing exactly what a legacy Windows application or database column would store for a given string.
- Testing a decoder or parser against known-good bytes in a specific charset, round-tripped through [charset decode](/util/charset_decode/).
- Building fixtures for mojibake-repair tools, since encoding to one charset and decoding as another is how that corruption happens in the first place.
- Feeding non-UTF-8 bytes into [data URI build](/util/data_uri_build/) with a matching `charset` label.

## Tips and pitfalls

- This is character-to-byte encoding, not encryption or compression. It changes representation, not meaning, and offers no security benefit.
- `windows-1252` and `iso-8859-1` agree on every byte below 0x80 and above 0x9F; they only disagree in the 0x80–0x9F control range, which is exactly where curly quotes and the em dash live in Windows-authored text.
- If you need to inspect what a piece of text actually contains before encoding it, run it through [unicode inspect](/util/unicode_inspect/) first. Its code point column makes it easy to spot characters a single-byte charset cannot hold (anything above U+00FF can never fit `iso-8859-1`).
- To see the encoded bytes laid out with an offset and ASCII gutter instead of a flat list, pipe the output to [hex dump](/util/hex_dump/).
