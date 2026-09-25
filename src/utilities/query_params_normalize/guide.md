---
title: Normalize URL Query Parameters Online
description: Sort, dedupe and strip tracking parameters from a URL or query string online, with wildcard drop patterns like utm_* and host lowercasing.
---
## What does normalizing query parameters mean?

Two URLs that point at the same resource often differ only in cosmetic ways: parameter order, repeated parameters, tracking codes appended by an email or ad campaign, or the case of the hostname. Normalizing rewrites a URL (or a bare query string) into one consistent, comparable form — the technique behind canonical URLs, cache keys, deduplicating log entries and stripping `utm_*` parameters before saving a link. This tool works on a full URL, a protocol-relative `//host/path?query` URL, or a plain `a=1&b=2` string, deciding which by whether the input looks like a URL.

## How it works

The default settings sort parameters alphabetically, keep only the last of any repeated key, and lowercase the scheme and host:

```example
title: sort, dedupe and lowercase host by default
input: https://EXAMPLE.com/Path?b=2&a=1&a=3
output: https://example.com/Path?a=3&b=2
```

Notice the path, `/Path`, keeps its original case — only the scheme and hostname are ever lowercased, never the path, query values or fragment. A bare query string is handled the same way, and a leading `?` is preserved if the input had one:

```example
title: a bare query string keeps its leading "?"
input: ?b=2&a=1
output: ?a=1&b=2
```

### Dropping tracking parameters

**Drop keys** takes a comma-separated list of names, where `*` matches any run of characters — so `utm_*` matches `utm_source`, `utm_medium` and so on, but nothing else. Matching is case-insensitive and checks both the raw and decoded key, so a pattern still matches even if the key arrived percent-encoded:

```example
title: strip utm_* and an exact key
params: {"drop": "utm_*,fbclid"}
input: https://example.com/p?utm_source=x&utm_medium=y&fbclid=z&id=7
output: https://example.com/p?id=7
```

If dropping keys (or dropping empty values) removes every parameter, the result has no `?` at all — the tool never leaves a bare trailing question mark unless the original had one with nothing else to anchor it to.

### Comparing repeated keys

**Dedupe repeated keys** controls what happens when the same key appears more than once: `none` keeps every occurrence, `first` keeps the first, and `last` (the default) keeps the most recent:

```example
title: keep only the first occurrence of a repeated key
params: {"dedupe": "first", "sort": false}
input: https://example.com/?a=1&b=9&a=2
output: https://example.com/?a=1&b=9
```

### Decoding values

By default, values are compared and sorted by their decoded form but rendered back exactly as they arrived — so `caf%C3%A9=1` and `café=1` sort as the same key without the output being rewritten. Turning **decode values** on rewrites the output to the decoded form instead:

```example
title: decode a percent-encoded query value
params: {"decode": true}
input: https://example.com/?q=%F0%9F%98%80&s=hello+world
output: https://example.com/?q=😀&s=hello world
```

## Options

- **sort by key** — on by default; sorts parameters alphabetically by their decoded key, then by value for ties.
- **dedupe repeated keys** — `none`, `first` or `last` (default).
- **drop empty values** — off by default; removes a parameter entirely when its value is empty.
- **drop keys** — a comma list of names to remove; `*` is the only wildcard and can appear anywhere in a name.
- **decode values** — off by default; see above. It decodes keys as well as values, and does not re-encode them, so a decoded `&`, `=` or `#` becomes a literal character that changes how the query parses.
- **lowercase scheme + host** — on by default; never touches the path, userinfo, query or fragment.

## Common uses

- Building canonical URLs for caching, deduplication or analytics.
- Stripping `utm_*`, `fbclid` and similar tracking parameters before sharing or storing a link.
- Comparing two URLs for equivalence regardless of parameter order.
- Cleaning up query strings captured from logs before further processing with [query string to json](/util/query_string_to_json/).

## Tips and pitfalls

- Malformed percent-encoding (`%ZZ`) causes an error (`invalid percent-encoding in query`) only when **decode values** is on; with decoding off, a broken escape is left untouched in the output.
- A scheme-less input like `Docs/Guide.html?b=2&a=1` is recognized as a relative path, not a hostname, so its case is left alone — only genuine host-shaped text such as `EXAMPLE.com/path` gets lowercased.
- To parse the normalized result into structured JSON, or to reassemble parts into a URL, use [query string to json](/util/query_string_to_json/) and [url build](/util/url_build/).
- [url parse](/util/url_parse/) gives you every URL component individually if you need more than a normalized query string.
