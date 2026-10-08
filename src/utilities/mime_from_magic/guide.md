---
title: File Type Detector: Identify Files by Magic Bytes
description: Detect a file's real type from its magic-number signature online, from raw bytes or a hex or base64 rendering, no file extension needed.
---
## What is a magic number?

Most binary file formats start with a fixed sequence of bytes (a "magic number") that identifies the format regardless of what the file is named: PNG always starts with `89 50 4E 47 0D 0A 1A 0A`, a gzip stream with `1F 8B`, a PDF with `%PDF-`. It is the same idea behind the Unix `file` command. This tool reads those leading bytes (or, for text formats with no fixed signature, the opening characters) and reports the file's real MIME type, extension and a short description, with a confidence score.

## How it works

Feed it raw bytes, or a hex or base64 rendering of them, and it checks a priority-ordered list of known signatures:

```example
title: a PNG signature, as hex
input-encoding: hex
input: 89504e470d0a1a0a
output:
{
  "mime": "image/png",
  "extension": "png",
  "description": "PNG image",
  "confidence": 1
}
```

Base64-encoded bytes work exactly the same way. The tool tries a hex reading, a base64 reading, and the literal characters, and keeps whichever produces the most confident match:

```example
title: the same PNG signature, base64-encoded
input: iVBORw0KGgo=
output:
{
  "mime": "image/png",
  "extension": "png",
  "description": "PNG image",
  "confidence": 1
}
```

Container formats get an extra look inside before a mime type is settled on: a ZIP signature is checked for entry names such as `word/document.xml`, `xl/workbook.xml` or `ppt/presentation.xml` (Office Open XML), an uncompressed `mimetype` entry (EPUB and OpenDocument formats), an Android manifest or a Java `META-INF/MANIFEST.MF`, rather than being reported as a generic ZIP archive. Only the first 64 KB are searched, so this needs more than the first few bytes of the file. When there is no known binary signature at all, the bytes are decoded as UTF-8 and matched against common text formats instead:

```example
title: text with no binary signature falls back to format sniffing
input: {"a":1,"b":[2,3]}
output:
{
  "mime": "application/json",
  "extension": "json",
  "description": "JSON document",
  "confidence": 0.7
}
```

When nothing matches at all, the result names that plainly rather than guessing:

```example
title: unrecognized bytes are reported honestly, not guessed at
input-encoding: hex
input: 13374299
output:
{
  "mime": "application/octet-stream",
  "extension": "",
  "description": "unrecognised binary data",
  "confidence": 0
}
```

Empty input produces an empty result rather than "unrecognized binary data", since there's nothing there to fail to recognize:

```example
title: empty input
input:
output:
{
  "mime": "",
  "extension": "",
  "description": "",
  "confidence": 0
}
```

## Understanding the result

- **mime** / **extension**: the detected MIME type and its usual file extension. Both are empty for empty input, and the extension is also empty for generic containers with no single extension (a RIFF container, a legacy Microsoft compound file).
- **description**: a short human-readable label for what was found.
- **confidence**: `1` for an unambiguous fixed signature (PNG, gzip, ELF, …), lower for heuristic matches (a ZIP whose inner file names *suggest* a docx, an EBML container with no readable DocType, or text sniffing, which never scores above 0.9 and gives plain text only 0.3, since almost anything could technically be text).

This utility takes no parameters. Behavior is entirely driven by the input bytes.

## Common uses

- Verifying an upload's real type when you don't trust its filename or the browser-reported MIME type.
- Identifying a mystery binary file dropped into a pipeline with no extension.
- Quick forensics on a byte dump, by pasting the leading bytes as plain hex (spaces between bytes are fine, but a hex editor's offset and ASCII columns must be removed first).
- Telling apart formats that share a container, like ZIP-based `.docx`/`.xlsx`/`.epub`/`.jar` files or `ftyp`-based `.mp4`/`.mov`/`.heic` files.

## Tips and pitfalls

- A signature like `MZ` (the classic DOS/Windows executable marker) is only trusted as an executable when the rest of the header looks convincingly binary. Plain text that merely starts with the letters "MZ" is correctly left as text.
- Byte-order marks are checked before the MPEG-audio-frame heuristic, so a UTF-16 text file's BOM bytes are never misread as the start of an MP3.
- A `confidence` of exactly `0` with `mime: "application/octet-stream"` means no signature matched at all. It doesn't mean the data is corrupt, just unidentified by this tool's rule set.
- To go the other direction (turning a known extension or MIME type into the other), use [mime type lookup](/util/mime_lookup/); to inspect the raw bytes yourself, [hex encode](/util/hex_encode/) and [base64 encode](/util/base64_encode/) produce the same representations this tool accepts as input.
