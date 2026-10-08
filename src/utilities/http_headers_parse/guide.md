---
title: HTTP Headers to JSON Parser Online
description: Parse a raw HTTP header block or full request or response into JSON online, folding repeated headers into arrays and unfolding continuation lines.
---
## What does http headers parse do?

Copying headers out of browser DevTools, `curl -i`, or a raw request/response dump gives you a block of `Name: value` lines that's tedious to search or diff by eye. This tool parses that block (with or without its request or status start line) into structured JSON, folding any repeated header into an array and unfolding old-style continuation lines.

## How it works

Paste a full request, and the method, path, HTTP version and every header come back as separate fields:

```example
title: a request with a start line
input: GET /users HTTP/1.1
Host: api.example.com
Accept: application/json
params: {"lowercaseNames": true, "indent": 2}
output:
{
  "startLine": "GET /users HTTP/1.1",
  "method": "GET",
  "path": "/users",
  "httpVersion": "HTTP/1.1",
  "headers": {
    "host": "api.example.com",
    "accept": "application/json"
  }
}
```

A response works the same way, and any header repeated on multiple lines (`Set-Cookie` being the classic example) folds into a JSON array instead of overwriting itself:

```example
title: a response with repeated Set-Cookie headers
input: HTTP/1.1 404 Not Found
Content-Type: text/html; charset=utf-8
Set-Cookie: a=1; Path=/
Set-Cookie: b=2; Path=/
output:
{
  "startLine": "HTTP/1.1 404 Not Found",
  "httpVersion": "HTTP/1.1",
  "status": 404,
  "statusText": "Not Found",
  "headers": {
    "content-type": "text/html; charset=utf-8",
    "set-cookie": [
      "a=1; Path=/",
      "b=2; Path=/"
    ]
  }
}
```

A block with no recognizable start line (just headers) is handled too, and by default every header name is lowercased for consistent lookups; turn `lowercaseNames` off to keep the original casing:

```example
title: original casing preserved
input: Host: example.com
User-Agent: curl/8.4.0
Accept: */*
params: {"lowercaseNames": false}
output:
{
  "headers": {
    "Host": "example.com",
    "User-Agent": "curl/8.4.0",
    "Accept": "*/*"
  }
}
```

HTTP/2 and HTTP/3 pseudo-headers keep their leading colon, and old-style "obs-fold" continuation lines (a header value wrapped onto the next line, indented with a space or tab) are joined back into a single value:

```example
title: pseudo-headers and folded continuation lines
input: :method: GET
X-Long: first
	second
:authority: api.test
output:
{
  "headers": {
    ":method": "GET",
    "x-long": "first second",
    ":authority": "api.test"
  }
}
```

## Options

- **lowercase header names**: on by default, since HTTP header names are case-insensitive; turn it off to preserve the exact casing from the input.
- **json indent (2 = structured value)**: with the default of `2`, the result is a real structured value that a downstream pipeline step can read directly. Any other value (`0`–`10`, excluding `2`) instead returns the JSON as pre-formatted text at that indent width. That is handy for copying a specific compact or wide rendering. A downstream step that expects JSON still parses that text.

## Common uses

- Turning a raw response dump (from `curl -i`, browser DevTools' "raw headers" view, or a packet capture) into JSON you can search, diff or assert against in a test.
- Extracting a specific header's value from a captured request without manual text parsing.
- Normalizing header casing and folding repeated headers before comparing two captures.
- Rebuilding the block with [json to http headers](/util/http_headers_build/) after editing it as JSON, or copying the `headers` object into a request for [json to curl command](/util/curl_build/), which also needs a full `url`.

## Tips and pitfalls

- Parsing stops at the first blank line, so pasting a full request or response *with its body included* is safe. The body is simply ignored rather than mis-parsed as more headers.
- A header line with no colon at all throws a clear error naming the offending line, since that's not valid header syntax to silently skip.
- Whether the first line is read as a request line depends on it starting with a recognized HTTP method (or carrying an explicit `HTTP/x.y` version token). A line that matches neither is read as an ordinary header line instead, and throws if it has no colon.
- To go the other direction and rebuild a header block from JSON, use [json to http headers](/util/http_headers_build/); to parse an entire curl command rather than just its headers, see [curl command to json](/util/curl_parse/).
