---
title: MIME Type Lookup: File Extension Converter Online
description: Look up the MIME type for a file extension or filename, or find the canonical file extension for a MIME type, right in your browser.
---
## What is a MIME type?

A MIME type (also called a media type or content type) is the label `Content-Type: application/pdf` or `image/png` that tells a browser, email client or API what kind of data it's looking at, independent of the filename. This tool looks up the MIME type for a file extension or a whole filename, or goes the other way and finds the canonical extension for a MIME type, from a table covering more than 200 formats.

## How it works

Give it a filename, a bare extension, or a full MIME type, and by default it auto-detects which direction to convert:

```example
title: filename to mime type
input: report.pdf
output: application/pdf
```

```example
title: mime type to extension
input: application/json
output: json
```

A path or URL works too. The tool strips directories, query strings and fragments before looking at the extension:

```example
title: a url's query string doesn't confuse the lookup
input: https://example.com/logo.svg?v=2
output: image/svg+xml
```

MIME type parameters like a charset are ignored when converting to an extension:

```example
title: a charset parameter is stripped before matching
input: text/html; charset=utf-8
output: html
```

Auto mode has to guess whether an ambiguous-looking token is a MIME type or a path, since both can contain a slash. It prefers the MIME reading when the text starts with a known top-level type (`text/`, `image/`, `application/`, and so on), but falls back to reading it as a path when that reading fails, so a filename that happens to start with a real media type's name still resolves correctly:

```example
title: a path that starts with a real top-level type still works
input: text/notes.md
output: text/markdown
```

## Options

- **direction**: `auto` (default, detects the direction from the input's shape), `extension-to-mime`, or `mime-to-extension`.
- **per line**: on by default, looking up each line independently; blank lines are preserved.

Where a MIME type has more than one common extension (`jpg`/`jpeg`, `html`/`htm`) or more than one legacy spelling (`image/jpg`, `text/xml`, `application/x-gzip`), the reverse lookup always returns one canonical extension. A round trip therefore normalizes rather than preserves: `jpeg` → `image/jpeg` → `jpg`, and an extension that shares a generic type, such as `har` or `map` (both `application/json`), comes back as `json`.

## Common uses

- Setting the right `Content-Type` header for a file upload or download without hardcoding a lookup table.
- Validating that an uploaded file's declared extension matches an expected MIME type.
- Picking a file icon or preview component based on a server-reported MIME type.
- Converting a list of file extensions into MIME types (or back) in bulk, one per line.

## Tips and pitfalls

- An unknown extension or MIME type throws a clear error naming exactly what wasn't recognized, rather than guessing or returning a generic `application/octet-stream`.
- A MIME type with a structured-syntax suffix that isn't in the table directly (`application/vnd.api+json`) still resolves via its suffix (`+json` → `json`) as a fallback.
- This tool only looks at the extension or type text itself; it never inspects file contents. To identify a file type from its actual bytes (useful when the extension is missing or untrustworthy), use [detect file type](/util/mime_from_magic/) instead.
- To embed a file together with its MIME type as a `data:` URI, see [data uri build](/util/data_uri_build/).
