---
title: Data URI Parser: Decode a data: URI to Text or Bytes
description: Parse a data: URI into its mime type, charset, encoding and payload, or extract the decoded content directly as text or bytes.
---
## What is a data URI?

A `data:` URI embeds a whole file's content inline as text, instead of pointing to it with a separate link. It has the shape `data:[<mime type>][;charset=<charset>][;base64],<payload>`, as defined by [RFC 2397](https://www.rfc-editor.org/rfc/rfc2397). You will see them as inline CSS backgrounds, embedded SVGs, tiny favicons, or the value a file input gives you after reading a file as a data URL in the browser. This tool takes one apart; [data URI build](/util/data_uri_build/) does the reverse.

## How it works

By default this tool returns a JSON breakdown of the URI: its mime type, charset, whether the payload is base64, the decoded data itself, and the payload's size in bytes.

```example
title: a base64 text data URI
input: data:text/plain;charset=utf-8;base64,SGVsbG8sIFdvcmxkIQ==
output:
{
  "mime": "text/plain",
  "charset": "utf-8",
  "base64": true,
  "data": "Hello, World!",
  "size": 13
}
```

```example
title: a percent-encoded payload with no mime type
input: data:,Hello%20World
output:
{
  "mime": "text/plain",
  "charset": "",
  "base64": false,
  "data": "Hello World",
  "size": 11
}
```

A missing mime type defaults to `text/plain`, as RFC 2397 specifies; a payload with no charset label is decoded as UTF-8, a superset of the RFC's US-ASCII default. The header is parsed loosely on purpose: it is split on `;`, each `key=value` pair is read case-insensitively, quoted values have their quotes stripped, and unrecognized parameters are ignored rather than rejected. Real-world data URIs are not always written in the exact case or order the spec shows.

### Getting just the decoded content

Set **output** to `text` or `bytes` to skip the JSON wrapper and get the decoded payload directly. This is useful when you already know what it contains and just want the content for the next step in a pipeline.

```example
title: output set to text
params: {"output": "text"}
input: data:text/plain;base64,SGVsbG8=
output: Hello
```

```example
title: a binary payload reported as base64, since it is not readable text
input: data:image/png;base64,iVBORw0KGgo=
output:
{
  "mime": "image/png",
  "charset": "",
  "base64": true,
  "data": "iVBORw0KGgo=",
  "size": 8
}
```

The default JSON output only puts the raw decoded text in `data` when the bytes actually decode as valid, printable text (tabs and newlines are fine; other control characters are not). Otherwise, as in the PNG example above, `data` holds the base64 form so binary content is never mangled by an attempted text decode. Ask for `output: bytes` if you need the raw bytes of an image or other binary payload.

## Options

- **output**: `json` (default, the full breakdown above), `text` (just the decoded payload as a string) or `bytes` (the raw decoded bytes).

## Common uses

- Inspecting what a `data:` URI you found in a stylesheet, HTML page or API response actually contains.
- Extracting an embedded image or font from a page's source for further processing.
- Decoding a browser file-reader result (which is itself a `data:` URI) back to its original text or bytes.
- Checking that a URI produced by [data URI build](/util/data_uri_build/) round-trips to the expected content.

## Tips and pitfalls

- The base64 payload is decoded leniently: whitespace inside it is stripped, the URL-safe alphabet (`-`/`_`) is accepted alongside the standard one, and missing padding is added automatically. A payload with an impossible length (one leftover base64 character) still throws, since there is no valid decoding for it.
- An input that is not a `data:` URI at all (a regular URL, or plain text) throws a clear error rather than returning empty or partial results.
- A charset label is honored when decoding text (`charset=iso-8859-1` bytes decode as Latin-1, not UTF-8) using the runtime's `TextDecoder`, so an unrecognized label falls back to UTF-8. In `text` output, bytes that are invalid in that charset become `�` rather than causing an error.
- To see the exact bytes behind a payload rather than a text guess, use `output: bytes` together with [hex dump](/util/hex_dump/).
