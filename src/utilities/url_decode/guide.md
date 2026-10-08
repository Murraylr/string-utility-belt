---
title: URL Decode Online: Percent-Decode URL Text
description: Percent-decode a URL-encoded string back to plain text with decodeURIComponent, including UTF-8 multi-byte sequences.
---
## What does URL decoding do?

URLs represent characters outside their safe set (spaces, punctuation with structural meaning, non-ASCII text) as `%` followed by two hex digits (a percent-encoded byte). This tool reverses that: it's the counterpart to [URL encode](/util/url_encode/), using JavaScript's `decodeURIComponent` to turn a percent-encoded string back into the plain text it represents, correctly reassembling multi-byte UTF-8 sequences along the way.

## How it works

The tool scans the input for `%XX` groups, converts each back to its byte value, and decodes the resulting bytes as UTF-8. Anything that isn't a `%XX` sequence, including characters that were never encoded in the first place, passes through unchanged.

```example
title: percent-decode
input: hello%20world%21
output: hello world!
```

```example
title: unicode
input: caf%C3%A9
output: café
```

Here `%C3%A9` is the two-byte UTF-8 encoding of `é`, reassembled into the single character.

```example
title: reserved characters
input: a%26b%3Dc
output: a&b=c
```

Text that's already plain, with no percent-encoding, passes through exactly as given, and decoding a path's `%2F` groups restores the literal slashes:

```example
title: path separators
input: %2Fpath%2Fto%2Ffile
output: /path/to/file
```

## Common uses

- Reading the real value behind a percent-encoded query parameter, path segment, or form field.
- Reversing output from [URL encode](/util/url_encode/) or any tool that produced `encodeURIComponent`-style escaping.
- Decoding URLs pasted from browser address bars, server logs, or API responses for inspection.
- Cleaning up percent-encoded text before further processing (search, comparison, display).

## Tips and pitfalls

- A malformed percent sequence throws an error rather than guessing at the intended character. Malformed means `%` not followed by two valid hex digits, or `%XX` bytes that don't form valid UTF-8 (such as `%E9`, which is `é` in Latin-1 but not in UTF-8). If you're decoding text from an unreliable source, expect to handle that error.
- This decodes one component's worth of encoding. If you have a full URL with a query string attached, take it apart first with [URL parse](/util/url_parse/), which decodes each part appropriately, rather than decoding the whole URL as one blob.
- To go the other direction, use [URL encode](/util/url_encode/).
- A literal `+` in the input is left as a literal `+` character, not converted to a space. That conversion is specific to `application/x-www-form-urlencoded` form data, not to URL decoding in general. If you're decoding a form-encoded body, convert `+` to a space yourself first.
