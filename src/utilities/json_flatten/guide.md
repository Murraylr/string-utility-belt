---
title: JSON Flatten Online — Nested JSON to Flat Key Paths
description: Flatten nested JSON into a single-level object online, keyed by dot or bracket path, with a configurable delimiter for spreadsheets and diffs.
---
## What does flattening JSON mean?

Deeply nested JSON is natural to write but awkward to put in a spreadsheet column, a flat key-value store, or a diff that should show one line per changed value. Flattening walks every path down to each leaf value — a string, number, boolean, null, or empty container — and turns it into one entry in a single-level object, keyed by the path that leads to it. [json unflatten](/util/json_unflatten/) reverses the process.

## How it works

Object keys are joined with a delimiter (`.` by default) and array indices are written in brackets:

```example
title: nested object and array
input: {"user":{"name":"Ada","tags":["core","dev"]},"active":true}
output:
{
  "user.name": "Ada",
  "user.tags[0]": "core",
  "user.tags[1]": "dev",
  "active": true
}
```

Only leaf values become entries — an empty object or empty array is kept as a leaf too, since there's no path underneath it to unpack, but a non-empty container is always walked into rather than kept as a JSON-encoded value.

### Array notation: bracket or dot

**Array notation** chooses how array indices are written relative to their parent path:

```example
title: dot notation for array indices instead of brackets
params: {"arrayNotation": "dot", "indent": 0}
input: {"user":{"tags":["x","y"]}}
output: {"user.tags.0":"x","user.tags.1":"y"}
```

### Choosing a delimiter

**Delimiter** is the separator between path segments; it defaults to `.` but can be anything, which matters if your keys themselves might contain a dot:

```example
title: a custom delimiter for keys that might contain a dot
params: {"delimiter": "/", "indent": 0}
input: {"a":{"b":{"c":1}},"d":[7]}
output: {"a/b/c":1,"d[0]":7}
```

### Ambiguous keys get quoted

If a key would be ambiguous under bracket array notation — because it's empty, looks like an array index, or contains the delimiter or a bracket character — it's wrapped in `['...']` instead of being joined plainly, so [json unflatten](/util/json_unflatten/) can reconstruct the exact original key rather than misreading it as an index or a nested path:

```example
title: an ambiguous key is quoted so it round-trips exactly
input: {"a.b":1,"0":2}
output:
{
  "['0']": 2,
  "['a.b']": 1
}
```

(Notice `"0"` is listed first even though `"a.b"` came first in the source — JavaScript always visits integer-like object keys in ascending numeric order before any other string keys, regardless of how they were written; flattening walks the object in that same order.)

## Options

- **delimiter** — the separator joining path segments (default `.`); must not be empty.
- **array notation** — `bracket` (default, `a[0]`) or `dot` (`a.0`).
- **indent** — spaces of indentation in the printed JSON, 0 to 10 (default 2).

## Common uses

- Preparing nested JSON for a flat table, CSV export, or spreadsheet where each row needs a single column per value.
- Producing a diff-friendly, one-line-per-value view of a document for comparison — see [json diff](/util/json_diff/) for a structural comparison instead of a flat listing.
- Generating environment-variable-style or dotted config keys (`DATABASE.HOST`) from a structured config object.
- Round-tripping through [json unflatten](/util/json_unflatten/) to verify that a chosen delimiter and notation don't collide with real key names.

## Tips and pitfalls

- The root value must be a JSON object or array; a bare string or number has no paths to flatten.
- If two different original paths would produce the same flattened key — for example because a key itself contains your chosen delimiter — flattening raises an error rather than silently overwriting one entry; pick a delimiter the keys don't contain, or use bracket quoting (the default) to avoid the collision.
- A `__proto__` key is flattened as ordinary data and never touches `Object.prototype`.
- To rebuild the nested structure from the flattened output, use [json unflatten](/util/json_unflatten/) with the same delimiter (it recognizes both array notations by itself). Only bracket notation round-trips exactly: with dot notation, an object key that looks like an index (`{"a":{"0":"x"}}` → `a.0`) is rebuilt as an array.
