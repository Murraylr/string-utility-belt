---
title: URL Builder Online — Assemble a URL from Parts
description: Build a URL string from JSON parts — protocol, host, path, query params and hash — online, with optional percent-encoding of each piece.
---
## What does this tool do?

Instead of hand-concatenating a protocol, host, path and query string (and getting the `?` versus `&` versus percent-encoding wrong somewhere), this tool takes a single JSON object describing the pieces of a URL and assembles them correctly. It is built to consume exactly the shape that [url parse](/util/url_parse/) produces, so the pair forms a round trip: parse a URL apart, edit a field, build it back into a valid URL.

## How it works

The input is a JSON object (or the equivalent JSON text) with any of a documented set of keys — `protocol`, `host`, `hostname`, `port`, `pathname`, `pathSegments`, `search`, `searchParams`, `hash`, `username`, `password`, `origin`. Only the keys you provide are used:

```example
title: assemble from protocol, host, path and query params
input: {"protocol": "https", "host": "example.com", "pathname": "/a/b", "searchParams": {"x": "1"}}
output: https://example.com/a/b?x=1
```

`protocol` does not need its trailing colon — `https` and `https:` are equivalent. If `host` is missing but `hostname` (and optionally `port`) is present, they are combined into a host automatically. `pathname` (already escaped, as `url parse` would return it) takes priority over `pathSegments` (unescaped path pieces to be joined and encoded individually) when both are given.

### Percent-encoding parts

With **percent-encode parts** on (the default), path segments from `pathSegments` and query keys and values from `searchParams` are percent-encoded with `encodeURIComponent` as they are inserted; `pathname` and `search`, which are assumed already escaped, are left as-is:

```example
title: percent-encode path segments and query values
params: {"encode": true}
input: {"protocol": "https:", "host": "example.com", "pathSegments": ["a b", "c/d"], "searchParams": {"q k": "x&y"}}
output: https://example.com/a%20b/c%2Fd?q%20k=x%26y
```

Turning encoding off skips that step and also skips the final URL normalization pass, so you get back exactly the literal text you supplied:

```example
title: encoding off leaves literal spaces alone
params: {"encode": false}
input: {"protocol": "https:", "host": "example.com", "pathSegments": ["a b"], "searchParams": {"q": "x y"}}
output: https://example.com/a b?q=x y
```

### Query values and arrays

`searchParams` is an object whose values may be a single scalar or an array — an array repeats the key once per item, which is how [url parse](/util/url_parse/) represents a repeated query parameter. If `searchParams` is absent or empty but `search` is present, that raw string is used as the query verbatim.

### URLs without a host

Not every URL has an authority. A relative reference just needs a path:

```example
title: a relative URL needs no protocol or host
input: {"pathname": "/search", "searchParams": {"q": "cats"}, "hash": "#top"}
output: /search?q=cats#top
```

Schemes such as `mailto:` have no `//` authority at all, so supplying only `protocol` and `pathname` produces `mailto:someone@example.com` rather than an invalid `mailto://…`. A scheme that does require an authority (`http`, `https`, `ws`, `wss`, `ftp`) throws a clear error if you give it a protocol but no host.

## Options

- **percent-encode parts** — on by default. Applies to `pathSegments` and to `searchParams` keys and values; `pathname` and `search` are assumed to already be correctly escaped.

## Common uses

- Editing one field of a URL — swap the host, add a query parameter, change the path — after breaking it apart with [url parse](/util/url_parse/).
- Programmatically constructing API endpoints or redirect URLs from structured data.
- Converting a JSON representation of a form's target URL back into a link.
- Combining with [json to query string](/util/json_to_query_string/) when you need more control over array or nesting format than the built-in `searchParams` handling gives you.

## Tips and pitfalls

- If none of the recognized keys are present but `href` is, the tool falls back to returning `href` verbatim — a convenient passthrough for JSON that only carries the whole URL.
- Passing an array, or a value that is not a JSON object, is an error: this tool always expects a single object describing one URL's parts.
- With encoding on and a protocol given, the assembled URL is also normalized by the WHATWG URL parser (lowercased scheme and host, internationalized hostnames converted to punycode, default ports dropped, and so on). A trip through [url parse](/util/url_parse/) and back therefore returns the normalized form, not always the identical string — for example `?q=a+b` comes back as `?q=a%20b`, and a bare `?flag` as `?flag=`.
- When several keys describe the same part, one wins: `host` over `hostname`/`port`, `pathname` over `pathSegments`, and a non-empty `searchParams` over `search`. Since url parse outputs all of them, edit `host`, `pathname` or `searchParams` (or delete the winning key) — changing only `hostname` or `search` has no effect.
- An empty input, or an object with no recognized keys and no `href`, produces an empty string rather than an error.
