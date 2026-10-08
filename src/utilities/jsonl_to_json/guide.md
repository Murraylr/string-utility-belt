---
title: JSONL to JSON Converter: NDJSON to Array
description: Collect newline-delimited JSON (JSONL or NDJSON) into a single JSON array online, skipping blank or invalid lines on request.
---
## What is JSONL, and what does converting it do?

JSONL (also called NDJSON, "newline-delimited JSON") is a line-oriented
format where every line is its own complete JSON value: an object, a
string, a number, anything. It is common in log files, streaming APIs, and
data pipelines because a consumer can process one record at a time without
loading the whole file, and a producer can append new records by just
writing another line. This tool collects those lines back into a single
JSON array, which is what most tools that were not built for streaming
actually expect.

## How it works

1. The input is split into lines (any of `\n`, `\r\n`, or `\r`); a single
   trailing newline at the end of the file is treated as a file convention,
   not an extra blank record.
2. Each remaining line is parsed as its own JSON value with `JSON.parse` and
   pushed onto an array, in order.
3. A blank line is skipped when **skip blank lines** is on (the default);
   turned off, a blank line throws an error naming its line number instead.
4. A line that fails to parse as JSON either throws an error naming the
   line number and the parse failure (**on invalid line**: `error`, the
   default), or is silently skipped (`skip`).
5. The result is serialized as a JSON array with the chosen **indent**.

```example
title: two JSONL records collected into an array
input:
{"id":1,"name":"Ada"}
{"id":2,"name":"Grace"}
output:
[
  {
    "id": 1,
    "name": "Ada"
  },
  {
    "id": 2,
    "name": "Grace"
  }
]
```

With **on invalid line** set to `skip`, both a blank line and a line that
fails to parse are dropped instead of stopping the conversion:

```example
title: skip blank and invalid lines
params: {"onError": "skip"}
input:
{"id":1,"name":"Ada"}

not json
{"id":2,"name":"Grace"}
output:
[
  {
    "id": 1,
    "name": "Ada"
  },
  {
    "id": 2,
    "name": "Grace"
  }
]
```

A JSONL file does not have to hold objects. Any JSON value is valid on its
own line (CRLF and lone-CR line endings are handled the same as LF):

```example
title: scalars on their own lines, compact output
params: {"indent": 0}
input: 1
"two"
true
null
output: [1,"two",true,null]
```

## Options

- **indent**: spaces of JSON indentation for the output array, from 0 to
  10 (default 2); `0` produces compact single-line JSON.
- **skip blank lines**: on by default, ignoring empty lines; off, a blank
  line throws unless **on invalid line** is also set to `skip`.
- **on invalid line**: `error` (default) stops on the first line that is
  not valid JSON, naming its line number; `skip` drops it and continues.

## Common uses

- Turning a log file of one JSON event per line into a single array for a
  script or spreadsheet that expects a normal JSON document.
- Recovering a usable array from a streaming API's NDJSON response.
- Cleaning up an export that mixes valid records with the occasional
  truncated or corrupted line, using **on invalid line**: `skip`.

## Tips and pitfalls

- To go the other direction (split a JSON array into one line per record),
  use [json to jsonl](/util/json_to_jsonl/). The two round-trip the same
  values, though not the original spacing.
- Each line goes through JavaScript's `JSON.parse`, so integers beyond
  2^53 (about 9 × 10^15) lose precision and a duplicated key keeps only its
  last value.
- Empty input (or input that is only whitespace) produces an empty array
  `[]` rather than an error.
- If you need to reformat the resulting JSON further (sort keys, minify,
  or pretty-print differently), chain [json sort keys](/util/json_sort_keys/),
  [json minify](/util/json_minify/), or [json pretty](/util/json_pretty/)
  after this step.
