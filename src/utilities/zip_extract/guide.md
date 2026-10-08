---
title: ZIP Extract Online: Pull One File from an Archive
description: Extract a single file from a ZIP archive online by name or path, as text or raw bytes, with case-insensitive and basename matching.
---
## What is ZIP extraction?

A ZIP archive bundles multiple files (and folders) into one container, each entry compressed
independently (usually with DEFLATE) and indexed by a central directory at the end of the file so a
reader can find any entry without scanning the whole archive. This tool reads that directory, locates
one entry by name, and decompresses just that entry, without unpacking the rest of the archive. For a
full inventory of everything an archive contains, see [zip list](/util/zip_list/) instead. The two
utilities are meant to be used together: list first to see what is there, then extract the entry you
need.

## How it works

Pass the archive as bytes and set **entry** to the path you want, exactly as it appears inside the
ZIP (forward slashes, e.g. `docs/readme.md`). Leaving **entry** blank extracts the first file in the
archive. That is handy for single-file ZIPs, or for a quick look at whatever an unfamiliar archive contains:

```example
title: extract a named entry as text
input-encoding: hex
input: 504b030414000000080039a9375df083a9ec0d0000000b0000000900000068656c6c6f2e747874f348cdc9c9d75188f20c500400504b030414000000080039a9375dcfbe36e00b000000090000000e000000646f63732f726561646d652e6d645356084a4d4cc94de50200504b0102140014000000080039a9375df083a9ec0d0000000b00000009000000000000000000000000000000000068656c6c6f2e747874504b0102140014000000080039a9375dcfbe36e00b000000090000000e0000000000000000000000000034000000646f63732f726561646d652e6d64504b05060000000002000200730000006b0000000000
params: {"entry": "hello.txt", "output": "text"}
output: Hello, ZIP!
```

Matching is forgiving on purpose: an exact path match wins first, but failing that the tool tries a
case-insensitive match, and then an unambiguous match on just the file's basename. So `readme.md`
finds `docs/readme.md` without you typing the full path, as long as no other entry shares that
basename. Leaving **entry** empty skips all of that and simply takes the first file in the archive
(directory entries are skipped):

```example
title: a blank entry extracts the first file in the archive
input-encoding: hex
input: 504b030414000000080039a9375df083a9ec0d0000000b0000000900000068656c6c6f2e747874f348cdc9c9d75188f20c500400504b030414000000080039a9375dcfbe36e00b000000090000000e000000646f63732f726561646d652e6d645356084a4d4cc94de50200504b0102140014000000080039a9375df083a9ec0d0000000b00000009000000000000000000000000000000000068656c6c6f2e747874504b0102140014000000080039a9375dcfbe36e00b000000090000000e0000000000000000000000000034000000646f63732f726561646d652e6d64504b05060000000002000200730000006b0000000000
output: Hello, ZIP!
```

**output** decides the format of the extracted content: `text` (default) decodes it as UTF-8, and
`bytes` returns the raw decompressed bytes untouched, the only sensible choice for an entry that
holds an image, a font, or any other non-text file. Here the same text entry comes back as its raw
decompressed bytes instead. A ZIP entry stored without compression (method "stored"; see
[zip list](/util/zip_list/) for how to check) comes through the same way, just without a DEFLATE step
first:

```example
title: extracting an entry as raw bytes
input-encoding: hex
input: 504b030414000000080039a9375df083a9ec0d0000000b0000000900000068656c6c6f2e747874f348cdc9c9d75188f20c500400504b030414000000080039a9375dcfbe36e00b000000090000000e000000646f63732f726561646d652e6d645356084a4d4cc94de50200504b0102140014000000080039a9375df083a9ec0d0000000b00000009000000000000000000000000000000000068656c6c6f2e747874504b0102140014000000080039a9375dcfbe36e00b000000090000000e0000000000000000000000000034000000646f63732f726561646d652e6d64504b05060000000002000200730000006b0000000000
params: {"entry": "hello.txt", "output": "bytes"}
output:
bytes[72, 101, 108, 108, 111, 44, 32, 90, 73, 80, 33]
hex: [48, 65, 6c, 6c, 6f, 2c, 20, 5a, 49, 50, 21]
utf8: Hello, ZIP!
```

## Options

- **entry**: the path inside the archive to extract, or blank for the first file. Matching falls back
  from an exact path, to case-insensitive, to an unambiguous basename match; if more than one entry
  shares the basename you asked for, the tool reports the conflict instead of guessing.
- **output**: `text` (default) decodes the entry as UTF-8; `bytes` returns the raw bytes.

## Common uses

- Pulling a single config file, license, or README out of a downloaded ZIP without unpacking
  everything.
- Reading one entry from an archive fixture in a test, without shelling out to an unzip tool.
- Extracting an embedded binary asset (an image, a font, a data file) from inside a `.zip`-based
  document format.
- Checking the exact bytes of one entry after re-zipping something, to confirm it round-tripped
  correctly.

## Tips and pitfalls

Only the **stored** and **deflate** compression methods are supported for extraction: the two methods
essentially every ZIP tool produces. An entry compressed with something else (bzip2, LZMA, and a
handful of other methods the ZIP format allows) fails with a clear "unsupported compression method"
error naming the method number; [zip list](/util/zip_list/) will show you which method an entry uses
before you try to extract it. Password-protected archives are not supported: AES-encrypted entries
are reported as method 99 and refused, and entries using the older ZipCrypto scheme are not decrypted
at all, so expect an error or meaningless bytes from them. Asking for a directory entry (a name ending in `/`) also fails on
purpose, since there is no file content to extract. List the archive to find the actual file paths
inside that folder. And if `output` is left at `text` for an entry that is not valid UTF-8, the tool
throws rather than returning corrupted characters; switch to `bytes` for anything binary.
