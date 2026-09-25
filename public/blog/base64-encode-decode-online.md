---
title: "How to Encode and Decode Base64 (JavaScript, Python, CLI)"
description: "Encode and decode Base64 correctly in JavaScript, Node.js, Python, and the command line, with UTF-8 handling, Base64url, and common error fixes."
date: 2025-09-18
updated: 2026-09-25
slug: base64-encode-decode-online
tags: [base64, encoding, javascript, python, cli]
---

# How to Encode and Decode Base64 (JavaScript, Python, CLI)

Base64 turns arbitrary binary data into plain ASCII text made up of the letters `A`-`Z`, `a`-`z`, the digits `0`-`9`, and the two symbols `+` and `/`, with `=` used for padding. It exists because many systems, including email, JSON, XML, HTTP headers, URLs and config files, were built to carry text safely, and can mangle or reject raw bytes such as `0x00` or invalid UTF-8. Encoding those bytes as Base64 turns them into something that survives any text-only channel unchanged.

The trade-off is size: every 3 bytes of input become 4 characters of output, so Base64 text runs about 33% larger than the original data. It is also worth saying plainly that Base64 is an encoding, not encryption. Anyone can decode it in one line of code, so it hides nothing and adds no security by itself; it only changes the representation of the data. This guide focuses on encoding and decoding it correctly in the environments you actually work in. If you want the byte-by-byte mechanics of how 3 bytes become 4 characters, the [Base64 encode](/util/base64_encode/) tool's guide walks through them step by step, so this guide skips them.

## Base64 in browser JavaScript

The browser gives you `btoa()` ("binary to ASCII") and `atob()` ("ASCII to binary"), but both only understand Latin-1: every character in the string must have a code point between 0 and 255. That works for plain ASCII text but breaks the moment you pass anything outside that range:

```js
btoa('€') // throws a DOMException: InvalidCharacterError
```

Real text is usually UTF-8, where a character like `€` or an emoji takes multiple bytes. To encode it correctly, convert the string to UTF-8 bytes first with `TextEncoder`, turn those bytes into a Latin-1-safe string, and only then call `btoa`. Decoding reverses the same steps with `atob` and `TextDecoder`:

```js
function toBase64(str) {
  const bytes = new TextEncoder().encode(str)
  const binary = String.fromCharCode(...bytes)
  return btoa(binary)
}

function fromBase64(b64) {
  const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

toBase64('café 😀')     // 'Y2Fmw6kg8J+YgA=='
fromBase64('aGVsbG8=')  // 'hello'
```

`atob` returns a "binary string" where each character's code unit is one decoded byte. That is exactly what `Uint8Array.from(binaryString, c => c.charCodeAt(0))` needs in order to rebuild the original bytes before handing them to `TextDecoder`.

## Base64 in Node.js

Node's `Buffer` handles the UTF-8 conversion for you, so there is no `btoa`/`atob` trap to work around:

```js
Buffer.from('hello', 'utf8').toString('base64')
// 'aGVsbG8='

Buffer.from('aGVsbG8=', 'base64').toString('utf8')
// 'hello'
```

Node also supports the `base64url` encoding directly, which is the URL-safe variant covered later in this guide:

```js
Buffer.from('hello', 'utf8').toString('base64url')
// 'aGVsbG8'  (no padding)
```

## Base64 in Python

Python's `base64` module works on bytes, so encode your string to UTF-8 first and decode the result back to a string for printing or storage:

```python
import base64

base64.b64encode('hello'.encode('utf-8')).decode('ascii')
# 'aGVsbG8='

base64.b64decode('aGVsbG8=').decode('utf-8')
# 'hello'

base64.urlsafe_b64encode('hello'.encode('utf-8')).decode('ascii')
# 'aGVsbG8='
```

Decoding a string with the wrong length raises `binascii.Error`:

```python
base64.b64decode('aGVsbG8')
# binascii.Error: Incorrect padding
```

Base64 text is always a multiple of 4 characters, which is what the `=` padding is for:

- A remainder of 3 characters needs one `=`, as in `TWE=`.
- A remainder of 2 characters needs two `=`, as in `TQ==`.
- A remainder of 1 character means the string is truncated, and no amount of padding can fix it.

`aGVsbG8` is 7 characters long, a remainder of 3, so adding a single `=` (`aGVsbG8=`) decodes correctly.

## Base64 on the command line

Linux distributions ship the GNU coreutils `base64` command, and so do Git Bash and WSL on Windows:

```bash
echo -n 'hello' | base64
# aGVsbG8=

echo -n 'aGVsbG8=' | base64 -d
# hello
```

Leave off `-n` and `echo` appends a trailing newline, which gets encoded along with the text and silently changes the result:

```bash
echo 'hello' | base64
# aGVsbG8K   (not aGVsbG8=)
```

By default, `base64` wraps its output at 76 columns, which matches the MIME convention but is rarely what you want when piping the result into another command or a JSON field. Add `-w 0` to turn wrapping off entirely, or pipe the output through [word wrap](/util/word_wrap/) later if you need a different width:

```bash
echo -n 'hello' | base64 -w 0
```

macOS ships a BSD `base64` instead. It does not wrap its output unless you ask it to (`-b 76`), has no `-w` option, and older versions decode with `-D` rather than `-d`.

OpenSSL has its own `base64` subcommand, with `-A` producing a single unwrapped line instead of the default wrap:

```bash
echo -n 'hello' | openssl base64 -A
# aGVsbG8=
```

On Windows, PowerShell's `[Convert]` class does the same job without any external tool:

```powershell
[Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes('hello'))
# aGVsbG8=

[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('aGVsbG8='))
# hello
```

## Base64 vs Base64url

Standard Base64 uses `+` and `/`, both of which already mean something inside URLs, query strings and file paths. Base64url replaces them with `-` and `_`, and padding is usually dropped as well. JWTs (see [JWT decode](/util/jwt_decode/)) use Base64url for exactly this reason: the header, payload and signature all need to sit safely inside a URL or an HTTP header without extra escaping.

| | Standard Base64 | Base64url |
| --- | --- | --- |
| 62nd character | `+` | `-` |
| 63rd character | `/` | `_` |
| Padding | always present | usually omitted |
| Safe in URLs and filenames | no | yes |

The difference is easiest to see with bytes that actually use those symbols: the three bytes `0xFB 0xFF 0xFE` encode as `+//+` in standard Base64 and `-__-` in Base64url. Same bits, different alphabet. Use [Base64url encode](/util/base64url_encode/) and [Base64url decode](/util/base64url_decode/) whenever the result has to travel through a URL; use the standard encoder for everything else.

## Troubleshooting common Base64 errors

### "Invalid character" or "illegal character"

This almost always means the text contains a character outside the alphabet the decoder expects. The most common cause is feeding Base64url text (with `-` or `_`) into a decoder that only understands the standard alphabet (`+`, `/`), or the other way around. Line breaks are usually harmless: `atob` ignores whitespace, and most decoders accept Base64 that has been wrapped onto several lines (GNU `base64 -d` skips newlines, although it rejects spaces unless you add `-i`). So if the error shows up on text that otherwise looks correct, check for a `-`/`_` versus `+`/`/` mismatch first.

### "Incorrect padding"

The decoder received a string whose length is not a multiple of 4. Add `=` characters using the remainder rule from the Python section above. If the text came from a URL or a JWT, it may be Base64url with its padding already stripped on purpose, which is normal; decode it with a Base64url-aware decoder rather than adding the padding back by hand.

### Accented or non-English characters turn into garbage

If decoding produces characters like `Ã©` where you expected `é`, the decoder read the bytes correctly but interpreted them as Latin-1 instead of UTF-8. `é` encodes to `w6k=`; calling raw `atob('w6k=')` gives you the two decoded bytes as Latin-1 characters (`Ã©`) instead of running them through a UTF-8 decoder. Use the `TextDecoder`-based approach from the JavaScript section above whenever the original text has anything outside plain ASCII.

### The decoded output is not readable text

That is expected when the original data was not text in the first place. A Base64 string can just as easily hold a compressed file, an image, or the raw bytes of a cryptographic hash, and decoding it correctly still produces exactly those bytes. It is not a bug if the result is not human-readable; it means the input was binary all along, not that the decode failed.

## Try it without writing any code

The [Base64 encode](/util/base64_encode/) and [Base64 decode](/util/base64_decode/) tools handle the UTF-8 conversion, padding and line-wrapping details above automatically, entirely in your browser, so nothing you paste in is ever uploaded anywhere. Browse the rest of the [tool library](/utilities/) for related conversions, including hex and Base64url.
