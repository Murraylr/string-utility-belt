---
title: URL Encode Online: Percent-Encode Text for URLs
description: Percent-encode text with encodeURIComponent so it is safe to use inside a URL query string, path segment, or form field.
---
## What does URL encoding do?

A URL can only safely contain a limited set of characters: letters, digits, and a handful of punctuation marks. Anything else (a space, an `&`, a `/` inside a value, non-ASCII text) has to be *percent-encoded*: written as `%` followed by two hex digits giving its byte value. This tool percent-encodes text using JavaScript's `encodeURIComponent`, which is the right choice whenever you're building one piece of a URL (a query parameter's value, a path segment, a form field) rather than a complete URL you've already assembled.

## How it works

Every character is checked against a small "safe" set. ASCII letters, digits, and the punctuation marks `- _ . ~ ! ' ( ) *` are left exactly as they are; everything else is converted to UTF-8 bytes and each byte is written as `%XX` in uppercase hex.

```example
title: reserved characters
input: hello world!
output: hello%20world!
```

Note that `!` stays literal (it's in the safe set) while the space becomes `%20`. `!`, `'`, `(`, `)` and `*` are left alone even though RFC 3986 classes them as reserved sub-delimiters. `encodeURIComponent` follows the older RFC 2396 here. Most servers don't care, but schemes that need strict RFC 3986 encoding (OAuth 1.0 signatures, for instance) must encode those five as well.

### Non-ASCII text becomes multiple percent-encoded bytes

Because encoding happens on UTF-8 bytes, not characters, an accented letter turns into more than one `%XX` group:

```example
title: unicode
input: café
output: caf%C3%A9
```

`é` is two UTF-8 bytes (`C3` and `A9`), so it becomes two percent-encoded groups.

### Characters with meaning in a URL are encoded too

This is the key difference from encoding a whole URL: characters that are structurally significant in a URL (`/`, `?`, `&`, `=`, `#`, `:`) are **not** in the safe set, because leaving them literal inside one component (say, a query value containing a slash) would change the URL's structure.

```example
title: path separators are encoded, not left as structure
input: /path/to/file
output: %2Fpath%2Fto%2Ffile
```

Unreserved characters (the ones that never need encoding in any part of a URL) are always left alone:

```example
title: unreserved characters are never encoded
input: a-b_c.d~e
output: a-b_c.d~e
```

## Common uses

- Encoding a value before appending it to a query string by hand (`?q=` + encoded value).
- Preparing user input, search terms, or file names to embed safely in a path segment or query parameter.
- Escaping values for `application/x-www-form-urlencoded` form data. Form decoders accept `%20`, though browsers themselves write a space there as `+`.
- Building API request URLs where a parameter value might contain spaces, slashes, or non-ASCII text.

## Tips and pitfalls

- Use this for one *piece* of a URL, not a whole URL you've already put together. Encoding an entire URL with this tool would also escape its own `://`, `?`, and `&` characters, breaking it. For building a full URL from parts, see [URL build](/util/url_build/); to take one apart, see [URL parse](/util/url_parse/).
- To reverse this encoding, use [URL decode](/util/url_decode/).
- Text containing an unpaired surrogate (half of an emoji, usually from a bad copy or truncation) has no UTF-8 form, so encoding it throws an error.
- A space becomes `%20` here (the correct form for a URL path or query value), not `+`. Using `+` for spaces is specifically an `application/x-www-form-urlencoded` convention, not a general URL rule.
- If you're building a whole query string from key-value pairs rather than encoding one value, [JSON to query string](/util/json_to_query_string/) and [query string to JSON](/util/query_string_to_json/) handle the encoding for every field automatically.
