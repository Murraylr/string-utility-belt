---
title: URL Parser Online — Split a URL into JSON Parts
description: Break a URL into JSON parts online — protocol, host, port, path segments, query params and hash — resolving relative URLs against a base.
---
## What does this tool do?

Every URL is built from smaller pieces: a scheme, an optional authority (userinfo, host, port), a path, a query string and a fragment. Reading those pieces out by hand with string slicing is error-prone once usernames, IPv6 hosts or percent-encoding get involved. This tool hands back every piece as a JSON object using the same field names as the browser's own `URL` interface, plus a few conveniences — a `pathSegments` array and a `searchParams` object that already folds repeated keys into arrays. Its counterpart is [url build](/util/url_build/), which does the reverse.

## How it works

A full, absolute URL is parsed directly, exposing every field:

```example
title: a full URL with userinfo, port, query and fragment
input: https://user:pw@example.com:8080/a/b?x=1&y=2#frag
output:
{
  "href": "https://user:pw@example.com:8080/a/b?x=1&y=2#frag",
  "protocol": "https:",
  "username": "user",
  "password": "pw",
  "host": "example.com:8080",
  "hostname": "example.com",
  "port": "8080",
  "pathname": "/a/b",
  "pathSegments": [
    "a",
    "b"
  ],
  "search": "?x=1&y=2",
  "searchParams": {
    "x": "1",
    "y": "2"
  },
  "hash": "#frag",
  "origin": "https://example.com:8080",
  "isAbsolute": true
}
```

`pathSegments` splits `pathname` on `/`, dropping empty segments, and `searchParams` turns `?a=1&a=2` into `{"a": ["1", "2"]}` — a key that appears once stays a plain string, a key that repeats becomes an array. A query parameter with no `=` at all (`?flag`) becomes an empty string, not `undefined`.

### Decoding

By default, path segments and query keys and values are percent-decoded (**decode percent-encoding**), with `+` in the query read as a space. Turn it off to see the still-escaped text instead — useful when you want to see exactly how a segment or value was encoded:

```example
title: percent-encoding left as-is when decoding is off
params: {"decodeParams": false}
input: https://example.com/caf%C3%A9?q=hi
output:
{
  "href": "https://example.com/caf%C3%A9?q=hi",
  "protocol": "https:",
  "username": "",
  "password": "",
  "host": "example.com",
  "hostname": "example.com",
  "port": "",
  "pathname": "/caf%C3%A9",
  "pathSegments": [
    "caf%C3%A9"
  ],
  "search": "?q=hi",
  "searchParams": {
    "q": "hi"
  },
  "hash": "",
  "origin": "https://example.com",
  "isAbsolute": true
}
```

### Relative URLs and a base

A relative reference such as `../images/logo.png` has no scheme or host of its own. Given a **base url**, it is resolved against it the same way a browser resolves a relative link:

```example
title: resolve a relative URL against a base
params: {"base": "https://example.com/docs/guide/"}
input: ../images/logo.png?v=2
output:
{
  "href": "https://example.com/docs/images/logo.png?v=2",
  "protocol": "https:",
  "username": "",
  "password": "",
  "host": "example.com",
  "hostname": "example.com",
  "port": "",
  "pathname": "/docs/images/logo.png",
  "pathSegments": [
    "docs",
    "images",
    "logo.png"
  ],
  "search": "?v=2",
  "searchParams": {
    "v": "2"
  },
  "hash": "",
  "origin": "https://example.com",
  "isAbsolute": false
}
```

`isAbsolute` reports whether the *input itself* was a complete URL, regardless of whether a base was needed to resolve it — here it is `false` because `../images/logo.png?v=2` only became absolute once combined with the base.

Without a base, a relative reference is still split by hand into path, query and hash, so `pathSegments` and `searchParams` remain usable even with no host to anchor to.

## Options

- **base url** — resolves a relative input against this URL, exactly like an HTML `<base>` tag. Left empty, a relative input is parsed on its own.
- **decode percent-encoding** — on by default; decodes `pathSegments` and `searchParams` keys and values. `pathname`, `search` and `href` always stay percent-encoded, as the URL parser serializes them (so a raw space or accented letter in the input shows up there as `%XX` escapes); for a relative input with no base they are simply the input text.

## Common uses

- Extracting query parameters, the hostname, or the path from a URL for logging, routing or validation.
- Checking what a redirect or relative link resolves to, given the page it appears on.
- Feeding structured URL data into [json diff](/util/json_diff/) to compare two links field by field.
- Preparing data for [url build](/util/url_build/) after editing one part of a URL.

## Tips and pitfalls

- `origin` is reported as an empty string, not the literal text `"null"`, for schemes with no real origin such as `mailto:`, `file:` or `data:` — a host that happens to be named `null` still gets a real origin.
- A single broken percent-escape (`%ZZ`) does not fail the whole parse; that piece is returned verbatim instead of throwing.
- `//example.com/a` (a network-path reference, no scheme) is recognized as having a real authority — `example.com` becomes the host, not the first path segment — while `///a/b` (an empty authority) is treated as a path.
- An absolute URL that fails to parse (`http://`, or a host containing a space) throws `invalid URL`; a relative reference with an unusable base does too.
