---
title: Query String to JSON Converter Online
description: Parse a URL query string into JSON online, understanding a[b], a.b, a[] and repeated keys, with optional number/boolean typing.
---
## What does this tool do?

A query string such as `a=1&b=2&b=3` is easy to read but awkward to work with in code: repeated keys, bracket notation and dotted paths all have to be interpreted before you get a usable structure. This tool parses a bare query string, or a full URL, into a JSON object, understanding the common conventions frameworks use to encode nested objects and arrays. It is the reverse of [json to query string](/util/json_to_query_string/), though a round trip is only exact for simple data: values come back as strings unless you turn on typing, a comma-joined list such as `tags=a,b` stays one string, and a one-element repeated array (`tags=a`) comes back as a plain value.

## How it works

Given input with a `?`, everything before it is discarded and everything after `#` is dropped, so a full URL and a bare query string are handled the same way:

```example
title: repeated key becomes an array, values typed
params: {"nested": "auto", "typed": true, "indent": 2}
input: a=1&b=2&b=3
output:
{
  "a": 1,
  "b": [
    2,
    3
  ]
}
```

A key that appears once becomes a single value; a key that appears more than once becomes an array of every value in order. In keys and values alike, `+` decodes to a space and `%XX` escapes are percent-decoded, as in `application/x-www-form-urlencoded`.

### Nesting modes

The **nesting** option chooses how compound keys are read:

```example
title: bracket notation groups keys into an object
params: {"indent": 0}
input: filter[color]=red&filter[size]=xl
output: {"filter":{"color":"red","size":"xl"}}
```

- `bracket` reads `a[b]` and `a[]` (only brackets).
- `dot` reads `a.b` (only dots).
- `auto` (the default) reads both in any mix, so `a[].b` and `a.b[c]` both work.
- `none` disables structure entirely: every key is taken literally, brackets and dots included.

An empty pair of brackets appends to an array; keys can also be brackets around a number for a specific index:

```example
title: array from repeated [] and object fields inside it
params: {"indent": 0}
input: items[][x]=1&items[][y]=2
output: {"items":[{"x":"1","y":"2"}]}
```

### Typing values

By default every value is a string, even `42` or `true`, since a query string carries no type information of its own. Turning **coerce numbers/booleans** on converts `true`/`false`/`null` and canonically-written numbers, while leaving everything else as text. That includes long integers that would lose precision as a JavaScript number, which are deliberately kept as strings:

```example
title: typed values, long ids kept as strings
params: {"typed": true, "indent": 0}
input: n=42&ok=true&id=9007199254740993
output: {"n":42,"ok":true,"id":"9007199254740993"}
```

## Options

- **nesting**: `auto` (default), `bracket`, `dot` or `none`, as described above.
- **coerce numbers/booleans**: off by default; when on, recognizes `true`, `false`, `null` and JSON-style numbers.
- **indent**: spaces of indentation in the printed JSON, 0 to 10 (default 2).

## Common uses

- Debugging what a link, redirect or webhook actually sends as parameters.
- Turning a captured URL into a JSON fixture for a test.
- Feeding a query string into a JSON-based pipeline step such as [jsonpath query](/util/jsonpath/) or [json diff](/util/json_diff/).
- Recovering structured filters or search state from a shared link.

## Tips and pitfalls

- A URL with no `?` at all, such as `https://example.dev/search`, has no query string, so the result is `{}` rather than treating the path as parameters.
- A key such as `a[__proto__][polluted]` is stored as an ordinary data key; it can never overwrite `Object.prototype`.
- Giving one key both a plain value and nested fields (`a=1` and `a[b]=2`, in either order) is a genuine conflict and raises an error rather than silently picking one.
- A malformed escape such as `%ZZ` also raises an error (`invalid percent-encoding`), whereas a browser's `URLSearchParams` would pass it through unchanged.
- To build the query string in the first place, or to check a value's exact JSON shape, use [json to query string](/util/json_to_query_string/) and [json pretty](/util/json_pretty/).
