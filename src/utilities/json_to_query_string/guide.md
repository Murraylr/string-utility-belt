---
title: JSON to Query String Converter Online
description: Convert a JSON object or array into a URL query string online, choosing array format, nesting style, percent-encoding, sorting and a leading "?".
---
## What does JSON to query string do?

A query string is the `key=value&key=value` text that follows the `?` in a URL. Web forms, REST APIs and analytics tools all consume it, but the data behind it is usually a structured object: a search form's state, a filter panel, or an API request body. This tool walks a JSON object or array and serializes it into that flat, ampersand-joined text, handling the two things plain string concatenation gets wrong — arrays and nested objects — in a choice of common conventions. Pair it with [query string to json](/util/query_string_to_json/) to go the other way, or [url build](/util/url_build/) if you need the query string embedded in a full URL alongside a host and path.

## How it works

The tool parses the input as JSON (or accepts an already-parsed object handed over from a previous pipeline step), then walks every key recursively, building one `key=value` pair per leaf value:

```example
title: flat object, spaces and a number
input: {"q":"hello world","page":2}
output: q=hello%20world&page=2
```

Scalars become their string form directly; `null` becomes an empty value and `false`/`true` become the literal words `false`/`true`:

```example
title: null and boolean values
input: {"a":null,"b":false}
output: a=&b=false
```

Empty objects and empty arrays contribute nothing to the output, since there is no key/value pair that could represent "nothing":

```example
title: empty containers are dropped entirely
input: {"a":[],"b":{},"c":"1"}
output: c=1
```

### Arrays: four formats

A JSON array has no single agreed query-string form, so **array format** picks one:

| format | `{"tags":["a","b"]}` becomes |
| --- | --- |
| `repeat` (default) | `tags=a&tags=b` |
| `bracket` | `tags[]=a&tags[]=b` |
| `comma` | `tags=a,b` |
| `index` | `tags[0]=a&tags[1]=b` |

```example
title: bracket array format
params: {"arrayFormat": "bracket"}
input: {"tags":["a","b"]}
output: tags[]=a&tags[]=b
```

`comma` only works for arrays of plain scalars (strings, numbers, booleans, `null`) — a comma-joined list has no way to express an object or a nested array, so an array containing one silently falls back to `index` for that array instead. With encoding on, a comma *inside* a member is escaped as `%2C` while the separating commas stay literal, so `["x,y","z"]` becomes `x%2Cy,z`.

### Nested objects: bracket, dot or json

**Nested objects** controls how a key like `filter.color` is written:

```example
title: dot notation for a nested object
params: {"nested": "dot"}
input: {"filter":{"color":"red"}}
output: filter.color=red
```

With `nested: "json"`, any object or array below the root is not walked at all (so array format no longer applies to it) — its exact JSON text becomes the value of a single key, percent-encoded like any other value. This is how some APIs expect complex filters to travel in a query string.

## Options

- **array format** — `bracket`, `repeat` (default), `comma` or `index`, as above.
- **nested objects** — `bracket` (`a[b]`, default), `dot` (`a.b`) or `json` (embed the child as a JSON string).
- **percent-encode** — on by default; encodes keys and values with `encodeURIComponent`, keeping only `[` and `]` unescaped in keys so bracket notation stays readable.
- **sort keys** — off by default; sorts the emitted pairs by key so the same object always produces the same string, useful for caching or diffing.
- **leading ?** — off by default; prepends `?` to a non-empty result.

## Common uses

- Turning a search form's state or filter panel into a shareable link.
- Building the query portion of an API request from a JSON payload.
- Producing a canonical, sorted query string for cache keys or URL comparison — see [normalize query params](/util/query_params_normalize/) if you already have a query string rather than JSON.
- Round-tripping through [query string to json](/util/query_string_to_json/) to test that a chosen format survives parsing.

## Tips and pitfalls

- The root value must be a JSON object or array — a bare string or number has no keys to serialize and throws an error.
- With encoding on, non-ASCII text is percent-encoded as UTF-8 bytes, the same as [url encode](/util/url_encode/): an accented letter or emoji becomes several `%XX` triplets.
- Turning encoding off is only safe if you know the values contain no `&`, `=` or other characters with special meaning in a query string.
- `arrayFormat: "comma"` and an array of objects don't mix — check the output if you rely on comma-joined arrays, since it silently switches to indices for that case.
