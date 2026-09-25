---
title: BOM Detector — Detect, Add or Remove a Byte Order Mark
description: Detect, add or remove a UTF-8, UTF-16LE or UTF-16BE byte order mark (BOM) in text or bytes, including BOMs pasted as mojibake text.
---
## What is a byte order mark?

A byte order mark (BOM) is a short sequence some encodings put at the very start of a file to signal which encoding — and which byte order — the rest of the file uses. In Unicode terms it is always the character U+FEFF (ZERO WIDTH NO-BREAK SPACE), but the bytes that represent it differ by encoding: `EF BB BF` for UTF-8, `FF FE` for UTF-16LE, `FE FF` for UTF-16BE, and `FF FE 00 00` / `00 00 FE FF` for the two UTF-32 byte orders. Some Windows software adds a UTF-8 BOM — older versions of Notepad did so for every "UTF-8" save, and Excel's "CSV UTF-8" export still does — while most Unix tools, JSON parsers, and shells expect none, which is a common source of "unexpected character at the start of the file" errors.

## How it works

This tool has three modes, chosen with the mode option:

- **detect** looks at the very start of the input and reports whether a mark is present, which encoding it belongs to, and its bytes as uppercase hex.
- **add** prepends the mark for a chosen encoding, first stripping any mark that is already there — so running it twice in a row is a no-op rather than doubling the mark.
- **remove** strips whichever mark is present at the start, and leaves the input untouched if there is none.

Detection checks the four-byte UTF-32 signatures before the two-byte UTF-16 ones, because the UTF-32LE mark's first two bytes (`FF FE`) are identical to the whole UTF-16LE mark. Without that ordering, a UTF-32LE file would be misreported as UTF-16LE followed by two NUL bytes.

```example
title: detect a UTF-8 mark in raw bytes
input-encoding: hex
params: {"mode": "detect"}
input: efbbbf68656c6c6f
output:
{
  "found": true,
  "encoding": "utf-8",
  "bytes": "EF BB BF"
}
```

```example
title: no mark present
params: {"mode": "detect"}
input: hello
output:
{
  "found": false,
  "encoding": null,
  "bytes": ""
}
```

### A mark pasted as mojibake text

A file's raw bytes sometimes end up pasted into a plain-text box that re-reads them one byte per character, which turns an invisible UTF-8 BOM into the three visible characters `ï»¿`. This tool recognizes that byte-view form too, so a BOM survives being copy-pasted through a Latin-1 lens:

```example
title: a UTF-8 mark that arrived as mojibake
params: {"mode": "detect"}
input: ï»¿hello
output:
{
  "found": true,
  "encoding": "utf-8",
  "bytes": "EF BB BF"
}
```

```example
title: add a mark, replacing any existing one
params: {"mode": "add", "encoding": "utf-8"}
input: hello
output: ﻿hello
```

The output of the "add" example above starts with an invisible U+FEFF character, followed by `hello` — copy it into another tool to see the mark survive.

```example
title: remove a mark and view the raw bytes left behind
input-encoding: hex
params: {"mode": "remove"}
input: efbbbf68656c6c6f
output:
bytes[104, 101, 108, 108, 111]
hex: [68, 65, 6c, 6c, 6f]
utf8: hello
```

## Options

- **mode** — `detect` (default), `add` or `remove`.
- **encoding** — which mark `add` prepends: `utf-8` (default), `utf-16le` or `utf-16be`. It is only consulted by `add`; `detect` and `remove` work out the encoding from the bytes themselves. UTF-32 marks can be detected and removed, but not added.

## Common uses

- Diagnosing "invalid JSON" or "unexpected token" errors caused by a stray BOM at the start of a config, CSV or data file.
- Stripping a BOM before feeding text into a parser that would otherwise treat it as literal data rather than a marker.
- Confirming which encoding and byte order a file was saved in before decoding it, for example with [charset decode](/util/charset_decode/).
- Normalizing a batch of files to consistently have — or not have — a BOM before diffing or concatenating them.

## Tips and pitfalls

- A byte order mark is metadata, not visible content. The Unicode Standard says a BOM in UTF-8 is neither required nor recommended, since UTF-8 has no byte order to disambiguate in the first place; it is added mainly for compatibility with tools that expect it.
- On text input, an actual U+FEFF character is always reported as `utf-8` (with bytes `EF BB BF`): once bytes have been decoded to text the original encoding is gone, so only the byte-view form or real bytes input can reveal a UTF-16 or UTF-32 mark.
- `found: false` only means the input does not start with a recognized mark — it says nothing about the actual encoding of the rest of the text. Try decoding it with [charset decode](/util/charset_decode/) under a few candidate charsets, or look at its code points with [unicode inspect](/util/unicode_inspect/).
- To see the exact bytes at the start of a file, run it through [hex dump](/util/hex_dump/): a UTF-8 BOM shows up as `ef bb bf`, the first three bytes of the hex column, right before the visible content starts.
- Adding a mark to bytes and to text are different operations under the hood: for text, the mark is always the single character U+FEFF; for bytes, the `encoding` option decides the exact byte sequence prepended.
