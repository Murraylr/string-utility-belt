---
title: Data URI Generator: Encode Text or Files as data:
description: Build a data: URI from text or bytes with a chosen mime type, base64 or percent-encoded payload, and optional charset, ready to embed inline.
---
## What is a data URI?

A `data:` URI embeds a small file directly inside another document instead of linking to a separate resource. It is defined by [RFC 2397](https://www.rfc-editor.org/rfc/rfc2397) and looks like `data:[<mime type>][;charset=<charset>][;base64],<data>`. Everything the browser needs to render the content is right there in the string. It is how a CSS file inlines a small icon, how an HTML page embeds a tiny image without a network request, and how tools represent in-memory files as plain text. [Data URI parse](/util/data_uri_parse/) does the reverse: it takes a `data:` URI apart again.

## How it works

Give this tool some text or bytes, a mime type, and whether to base64-encode the payload, and it assembles the header and data into one URI.

```example
title: base64-encoded text, the default
params: {"mime": "text/plain", "base64": true}
input: hello
output: data:text/plain;charset=utf-8;base64,aGVsbG8=
```

```example
title: percent-encoded instead of base64
params: {"mime": "text/plain", "base64": false}
input: a b
output: data:text/plain;charset=utf-8,a%20b
```

Percent-encoding only escapes bytes outside the RFC 3986 unreserved set (letters, digits, `-`, `.`, `_`, `~`); every other byte becomes `%XX`. The `charset` parameter is independent of `base64`: it defaults to `utf-8` and only disappears from the header when you clear it explicitly, as the next example does.

```example
title: a non-text mime type with binary bytes
input-encoding: hex
params: {"mime": "image/png", "base64": true, "charset": ""}
input: 89504e47
output: data:image/png;base64,iVBORw==
```

### Non-UTF-8 payloads

The **charset** parameter is only a label written into the header. It does not change how this tool encodes your input, which is always serialized as UTF-8 (or used as-is if the input is already bytes). To build a URI that actually contains non-UTF-8 bytes, convert first with [charset encode](/util/charset_encode/), then wrap the resulting bytes with a matching `charset` value:

```example
title: labeling bytes from charset encode honestly
input-encoding: hex
params: {"mime": "text/plain", "base64": false, "charset": "iso-8859-1"}
input: 6361 66e9
output: data:text/plain;charset=iso-8859-1,caf%E9
```

The four bytes above (`63 61 66 e9`) are `café` encoded as ISO-8859-1. Note the single byte `E9` for `é`, unlike its two-byte UTF-8 form. [Data URI parse](/util/data_uri_parse/) reads the `charset=iso-8859-1` label back and decodes it to `café` correctly.

## Options

- **mime type**: defaults to `text/plain`. Must look like `type/subtype` (RFC 2045 tokens) or be left empty; anything else, such as a bare `textplain` or one with extra parameters attached, is rejected.
- **base64 encode**: on by default. When off, the payload is percent-encoded instead, which stays more human-readable for short ASCII-heavy text but grows faster for arbitrary bytes.
- **charset**: defaults to `utf-8`. Written into the header as a label for readers; clear it to omit the parameter entirely. Mime type and charset are both normalized to lower case in the output so a build-then-parse round trip is stable.

## Common uses

- Embedding a small image, icon or font directly in CSS or HTML without an extra network request.
- Sharing a short binary fixture (a favicon, a tiny WAV file, a test payload) as a single copyable string.
- Producing base64 or percent-encoded reference values for other tools to decode against.
- Inlining a generated file (a QR code, a generated image, a small JSON blob) as a downloadable or embeddable link.

## Tips and pitfalls

- Base64 output is roughly 33% larger than the original bytes; for large files a real upload or file reference is almost always a better choice than inlining.
- An empty mime type is simply left out of the header (with charset also cleared and base64 off you get a bare `data:,<payload>`). That is legal: RFC 2397 says a missing media type means `text/plain;charset=US-ASCII`, and [data URI parse](/util/data_uri_parse/) likewise reads it back as `text/plain`.
- The unreserved set for percent-encoding is deliberately small (RFC 3986); if you need commas, parentheses or other "URL-safe-looking" punctuation to stay literal, remember they will still be escaped here.
- To verify a data URI you built (or received) round-trips correctly, feed it straight into [data URI parse](/util/data_uri_parse/) and check the `data` field matches your original input (for a binary payload that field holds base64, so compare with its `bytes` output instead).
