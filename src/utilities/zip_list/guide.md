---
title: ZIP List Online — Inspect a .zip Archive's Contents
description: List every entry in a ZIP archive online with its original size, compressed size and compression method, without extracting any files.
---
## What is a ZIP listing?

Every ZIP archive ends with a central directory: a compact index of every entry's name, size,
compression method, and where its data sits in the file. A listing reads only that directory — it
never decompresses a single entry — so it stays fast on large archives and works even for entries
whose compression method this app cannot decode. Pair it with [zip extract](/util/zip_extract/) once you
know which entry you actually want.

## How it works

Feed in the archive bytes and get back a JSON summary: a total entry count, the summed original and
compressed sizes across the whole archive, and a per-entry breakdown in the order the entries appear
in the central directory.

```example
title: list a two-file archive
input-encoding: hex
input: 504b030414000000080039a9375df083a9ec0d0000000b0000000900000068656c6c6f2e747874f348cdc9c9d75188f20c500400504b030414000000080039a9375dcfbe36e00b000000090000000e000000646f63732f726561646d652e6d645356084a4d4cc94de50200504b0102140014000000080039a9375df083a9ec0d0000000b00000009000000000000000000000000000000000068656c6c6f2e747874504b0102140014000000080039a9375dcfbe36e00b000000090000000e0000000000000000000000000034000000646f63732f726561646d652e6d64504b05060000000002000200730000006b0000000000
output:
{
  "count": 2,
  "totalSize": 20,
  "totalCompressedSize": 24,
  "entries": [
    {
      "name": "hello.txt",
      "size": 11,
      "compressedSize": 13,
      "method": "deflate",
      "directory": false
    },
    {
      "name": "docs/readme.md",
      "size": 9,
      "compressedSize": 11,
      "method": "deflate",
      "directory": false
    }
  ]
}
```

Each entry reports its **name** (read as UTF-8 when the archive flags it that way, as modern tools
do, so non-ASCII characters and emoji come through; otherwise one character per byte), its
uncompressed **size**, its **compressedSize** on disk, whether it is a **directory** entry (a name
ending in `/`, holding no file content), and its **method** — `stored` for uncompressed data,
`deflate` for the overwhelming majority of real-world ZIPs, or a named/numbered method for anything
else the ZIP format allows:

```example
title: a larger archive, including a non-ASCII filename and a stored entry
input-encoding: base64
input: UEsDBBQAAAAIAI8qZVjwg6nsDQAAAAsAAAAJAAAAaGVsbG8udHh080jNycnXUYjyDFAEAFBLAwQUAAAACACPKmVYPmfg3yUAAABEAgAADgAAAGRvY3MvcmVhZG1lLm1kU1YIySzJSeXiCs7PTVUoSa0oUShKLUhNLElN0VMYlRyVJEISAFBLAwQUAAAICACPKmVYWVHm9x0AAAAaAAAAFwAAAHVuaWNvZGUvbmHDr3ZlLfCfmIAudHh0yzi8MicnX6H88LainBSFRw1TFD7Mn9Gg8GjOZABQSwMEFAAAAAAAjyplWCqG7skHAAAABwAAAA4AAAByYXcvc3RvcmVkLmJpbgABAgP//v1QSwECFAAUAAAACACPKmVY8IOp7A0AAAALAAAACQAAAAAAAAAAAAAAAAAAAAAAaGVsbG8udHh0UEsBAhQAFAAAAAgAjyplWD5n4N8lAAAARAIAAA4AAAAAAAAAAAAAAAAANAAAAGRvY3MvcmVhZG1lLm1kUEsBAhQAFAAACAgAjyplWFlR5vcdAAAAGgAAABcAAAAAAAAAAAAAAAAAhQAAAHVuaWNvZGUvbmHDr3ZlLfCfmIAudHh0UEsBAhQAFAAAAAAAjyplWCqG7skHAAAABwAAAA4AAAAAAAAAAAAAAAAA1wAAAHJhdy9zdG9yZWQuYmluUEsFBgAAAAAEAAQA9AAAAAoBAAAAAA==
output:
{
  "count": 4,
  "totalSize": 624,
  "totalCompressedSize": 86,
  "entries": [
    {
      "name": "hello.txt",
      "size": 11,
      "compressedSize": 13,
      "method": "deflate",
      "directory": false
    },
    {
      "name": "docs/readme.md",
      "size": 580,
      "compressedSize": 37,
      "method": "deflate",
      "directory": false
    },
    {
      "name": "unicode/naïve-😀.txt",
      "size": 26,
      "compressedSize": 29,
      "method": "deflate",
      "directory": false
    },
    {
      "name": "raw/stored.bin",
      "size": 7,
      "compressedSize": 7,
      "method": "stored",
      "directory": false
    }
  ]
}
```

Empty input is not an error — it simply lists zero entries. (Directory entries, by contrast, are
listed and counted like any other entry, with `directory: true`.)

```example
title: empty input lists nothing
input:
output:
{
  "count": 0,
  "totalSize": 0,
  "totalCompressedSize": 0,
  "entries": []
}
```

## Common uses

- Auditing what a downloaded ZIP actually contains before extracting anything from it.
- Checking whether an archive is worth decompressing at all — a `totalCompressedSize` close to
  `totalSize` usually means the content was already compressed (images, video, other archives).
- Confirming which method each entry uses before picking one to pull out with
  [zip extract](/util/zip_extract/), since only `stored` and `deflate` entries can be extracted here.
- Spot-checking that a ZIP-producing pipeline included every file it was supposed to, by comparing
  entry counts and names.

## Tips and pitfalls

Listing never decompresses anything, so it succeeds even for entries using a compression method this
app cannot decode — bzip2, LZMA, or anything else the ZIP format allows — reporting them as a named or
numbered method rather than failing. That makes this the safe first step on an unfamiliar archive:
check what is inside, and only reach for [zip extract](/util/zip_extract/) on the entries whose method
is `stored` or `deflate`. Sizes are reported in bytes as stored in the archive's own metadata, not
measured by actually inflating each entry, so they reflect what the archive claims rather than a
re-verified truth — a maliciously crafted archive could in principle claim different sizes than its
real content, though that only matters if you are treating an untrusted ZIP as more trustworthy than
it is. A structurally valid ZIP with no entries at all — just an end-of-central-directory record and
nothing else — is a real, if unusual, possibility and lists cleanly as zero entries rather than
erroring out.
