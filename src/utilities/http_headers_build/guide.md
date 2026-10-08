---
title: JSON to HTTP Headers Converter Online
description: Turn JSON headers back into a raw HTTP header block online, with canonical header casing, a request or status start line, and CRLF or LF endings.
---
## What does http headers build do?

This is the reverse of [http headers to json](/util/http_headers_parse/): give it JSON describing a set of headers (plus, optionally, a request method/path or a response status) and it writes out a raw HTTP header block in HTTP/1.1 text form, with each header on its own line in `Name: value` form.

## How it works

The simplest input is `{ method, path, headers }`, which builds a request start line followed by each header, canonically cased and title-dashed:

```example
title: a request block with a start line
input:
{
  "method": "get",
  "path": "/users",
  "headers": { "content-type": "application/json", "x-request-id": "abc123" }
}
params: {"canonicalCase": true, "eol": "lf"}
output: GET /users HTTP/1.1
Content-Type: application/json
X-Request-Id: abc123
```

A handful of well-known headers don't follow simple Title-Case-Per-Dash. `ETag`, `WWW-Authenticate`, `TE`, `DNT`, `Content-MD5`, the `Sec-WebSocket-*` headers and `Sec-CH-UA`, `Sec-CH-UA-Mobile` and `Sec-CH-UA-Platform` keep their conventional casing (other `Sec-CH-UA-*` hints come out as `Sec-Ch-Ua-…`):

```example
title: well-known headers keep their conventional casing
input: {"headers": {"etag": "\"v1\"", "www-authenticate": "Basic realm=\"x\"", "te": "trailers"}}
params: {"eol": "lf"}
output: ETag: "v1"
WWW-Authenticate: Basic realm="x"
TE: trailers
```

Give it `status` (and optionally `statusText`) instead of a method/path to build a response line. An omitted `statusText` falls back to the standard reason phrase for that code, and an array value for a header repeats that header on its own line for each entry:

```example
title: a status line with a default reason phrase and repeated headers
input: {"status": 404, "headers": {"set-cookie": ["a=1", "b=2"]}}
params: {"eol": "lf"}
output: HTTP/1.1 404 Not Found
Set-Cookie: a=1
Set-Cookie: b=2
```

HTTP/2 pseudo-headers (`:method`, `:path`, `:authority`, …) own their leading colon and are never title-cased, since they're lowercase by definition in the HTTP/2 and HTTP/3 wire formats:

```example
title: pseudo-headers stay lowercase and colon-prefixed
input: {"headers": {":method": "GET", ":authority": "api.test"}}
params: {"eol": "lf"}
output: :method: GET
:authority: api.test
```

## Options

- **canonical header casing**: on by default (`Content-Type`); turn it off to emit header names exactly as given, unchanged.
- **line endings**: `crlf` (default, the real HTTP wire format) or `lf`, which is easier to read and diff in a plain-text tool.

Besides `{ method, path, headers }` and `{ status, statusText, headers }`, the tool also accepts a bare header map (`{ "content-type": "text/plain" }`) with no wrapper object, an array of `[name, value]` pairs, `{ name, value }` objects, or `"name: value"` strings: whichever shape a previous pipeline step (or [http headers to json](/util/http_headers_parse/)) happened to produce.

## Common uses

- Rebuilding a raw request or response block after editing its headers as JSON.
- Generating a mock HTTP response for a test fixture or a stub server.
- Producing header text for documentation from a structured description of an endpoint.
- Round-tripping through [http headers to json](/util/http_headers_parse/) to normalize header casing or line endings in a captured request.

## Tips and pitfalls

- If you edit `method`/`path` (or `status`) after parsing a header block that still carries its original `startLine`, the edited fields win. The stale start line is only used as a fallback when no structured method/status field is present.
- A header value containing a line break is rejected outright, since that's exactly the shape of an HTTP header-injection payload. This tool will not let you build one by accident.
- An empty or invalid header name, or a header value that is an object rather than a string, number, boolean or array of those, throws a clear error rather than producing a malformed line. A `null` value is skipped.
- To turn the same JSON headers into a runnable request, put them under `headers` in the input to [json to curl command](/util/curl_build/); to get a headers object out of a captured curl command, see [curl command to json](/util/curl_parse/).
