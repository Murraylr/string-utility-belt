---
title: JSON to JSONL Converter — Array to NDJSON
description: Split a JSON array into newline-delimited JSON (JSONL or NDJSON) online, one compact record per line.
---
## What does converting JSON to JSONL do?

JSONL (also called NDJSON) writes one complete, compact JSON value per
line instead of one big document. That shape is what log pipelines and
streaming ingestion APIs typically expect — the same shape `jq -c '.[]'`
prints — because each line can be read, parsed, and processed
independently without loading the whole file into memory. This tool takes a normal JSON array and splits
it into exactly that: one line per element, each compacted with no extra
whitespace.

## How it works

1. The input is parsed as JSON. If it is an array, every element becomes
   one line; if it is any other JSON value — an object, a string, a number —
   the whole document becomes a single line, since there is nothing to
   split.
2. Each element is serialized compactly (`JSON.stringify` with no
   indentation) and the lines are joined with `\n`.
3. The Unicode line and paragraph separators U+2028 and U+2029, which
   `JSON.stringify` leaves unescaped inside strings, are written as literal
   characters. They are not `\n` or `\r`, so a JSONL reader that splits on
   those — including [jsonl to json](/util/jsonl_to_json/) — still sees one
   record per line; a reader that splits with something broader, such as
   Python's `str.splitlines()`, will break those records apart.

```example
title: an array of records, one per line
input: [{"id":1,"name":"Ada"},{"id":2,"name":"Grace"}]
output: {"id":1,"name":"Ada"}
{"id":2,"name":"Grace"}
```

A document that is not an array — a single object, a string, or a number —
becomes one line, since JSONL only needs to split when there is more than
one record to separate:

```example
title: a non-array document becomes a single line
input: {"a":1}
output: {"a":1}
```

An empty array produces empty output rather than a line reading `[]`, since
there are no elements to write a line for; embedded newlines inside a
string value are escaped so every record still stays on exactly one line:

```example
title: an empty array produces no output at all
input: []
output:
```

## Options

This utility has no configurable options — it always compacts every
element and separates them with `\n`.

## Common uses

- Preparing a JSON array for a log pipeline, message queue, or streaming
  API that expects one JSON value per line.
- Producing input for command-line JSON tools that process JSONL, or for
  appending new records to an existing NDJSON file one line at a time.
- Shrinking a JSON array to a more diff-friendly, line-oriented form before
  storing it in version control.

## Tips and pitfalls

- To collect JSONL back into a single JSON array, use
  [jsonl to json](/util/jsonl_to_json/). Round-tripping an array through
  both gives back the same values, including embedded newlines and
  non-ASCII text, though not the original spacing; a single non-array value
  comes back wrapped in an array.
- The input goes through JavaScript's `JSON.parse`, so integers beyond 2^53
  (about 9 × 10^15) lose precision and a duplicated key keeps only its last
  value.
- There is no newline after the last record, so when appending the output
  to an existing JSONL file, make sure a newline separates it from the
  records around it.
- Invalid JSON input throws an error rather than guessing at a line split.
- Because each element is compacted independently, this is also a quick way
  to turn a pretty-printed JSON array into one minified value per line
  without affecting the structure of any individual element.
