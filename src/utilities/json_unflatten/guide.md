---
title: JSON Unflatten Online — Rebuild Nested JSON from Paths
description: Rebuild nested JSON online from a flat object of dot or bracket path keys, turning numeric segments back into arrays automatically.
---
## What does unflattening JSON mean?

A flat object like `{"user.name": "Ada", "user.tags[0]": "x"}` is convenient to store in a spreadsheet row or a simple key-value table, but it isn't the nested shape most code expects to work with. This tool reads each key as a path — split on a delimiter, with bracketed or dotted numeric segments recognized as array indices — and rebuilds the full nested object or array those paths describe. It's the reverse of [json flatten](/util/json_flatten/): with flatten's default bracket notation, flattening a document and then unflattening it reproduces the original data (with dot notation, an object key that looks like an index, such as `"0"`, comes back as an array index).

## How it works

Each key in the input object is split into path segments, and a nested structure is built up one key at a time:

```example
title: rebuild a nested object and an array
input: {"user.name":"ada","user.tags[0]":"x","user.tags[1]":"y","ok":true}
output:
{
  "user": {
    "name": "ada",
    "tags": [
      "x",
      "y"
    ]
  },
  "ok": true
}
```

A segment is treated as an array index whenever it's a plain non-negative integer with no leading zeros — whether written with a delimiter (`a.0`) or in brackets (`a[0]`) — so both notations work automatically without needing to be told which one was used to flatten the data:

```example
title: numeric dot segments become array indices too
input: {"a.0":1,"a.1":2}
output:
{
  "a": [
    1,
    2
  ]
}
```

### Choosing a delimiter

**Delimiter** must match whatever separator the data was flattened with; it defaults to `.`:

```example
title: a custom delimiter
params: {"delimiter": "/", "indent": 0}
input: {"a/b/c":1,"d[0]":7}
output: {"a":{"b":{"c":1}},"d":[7]}
```

### Quoted segments stay literal

A bracketed, quoted segment such as `['a.b']` is always read as one literal object key, even if it contains characters — a dot, a digit, an empty string — that would otherwise be structural. This is what lets [json flatten](/util/json_flatten/)'s quoting of ambiguous keys round-trip correctly:

```example
title: a quoted segment is a literal key, not a nested path
input: {"['a.b']":1,"['0']":2}
output:
{
  "a.b": 1,
  "0": 2
}
```

### Gaps and ordering

If the numeric indices you supply skip a value — `a[2]` given before `a[0]`, with no `a[1]` — the missing slot is filled with `null` rather than shifting later elements down, so `["a", null, "c"]` rather than `["a", "c"]`.

## Options

- **delimiter** — the separator splitting each key into path segments (default `.`); must not be empty.
- **indent** — spaces of indentation in the printed JSON, 0 to 10 (default 2).

## Common uses

- Rebuilding structured JSON from a spreadsheet export or a flat key-value config store.
- Reversing [json flatten](/util/json_flatten/) after editing individual flattened values.
- Turning a flat set of form field names (`address.city`, `address.zip`) back into a nested payload for an API.
- Reconstructing an array-of-objects shape from indexed keys produced by another tool.

## Tips and pitfalls

- Two paths that disagree about the shape at the same location — one implying an array, the other an object, or one ending at a value that another path tries to nest into — raise an error rather than silently picking one interpretation.
- A `__proto__` segment anywhere in a path is rebuilt as an ordinary data key; it can never overwrite `Object.prototype`.
- The input must be a flat, non-array JSON object; if it's already nested, there's nothing to unflatten — arrays and objects as values are passed through untouched as leaves rather than being flattened first.
- Getting the delimiter wrong just produces literal keys like `"user.name"` in the output instead of the nested shape you expected — double-check it matches what [json flatten](/util/json_flatten/) (or your original source) actually used. Array notation needs no setting: bracketed and dotted indices are both recognized.
