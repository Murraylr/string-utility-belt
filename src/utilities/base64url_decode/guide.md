---
title: Base64URL Decode Online: URL-Safe Base64 Decoder
description: Decode URL-safe or standard Base64 to text or raw bytes online, tolerating missing padding and whitespace. Ideal for JWT segments.
---
## What is Base64url decoding?

This reverses [base64url encode](/util/base64url_encode/): it takes a URL-safe Base64 string (using `-` and `_` in place of `+` and `/`, usually without `=` padding) and recovers the original text or bytes. It is what you need to read a [JWT](/util/jwt_decode/)'s header and payload by hand, since both are Base64url-encoded JSON.

Unlike [base64 decode](/util/base64_decode/), which only recognizes `+` and `/` and rejects a wrong amount of `=` padding, this tool accepts **either** alphabet and ignores any run of trailing `=`, which makes it the more forgiving choice whenever you're not sure which flavor of Base64 you're looking at.

## How it works

1. Whitespace is stripped, and any trailing `=` padding is removed.
2. Each remaining character is looked up in a combined table that recognizes both `-`/`_` and the standard `+`/`/`.
3. Every 4 characters (24 bits) become 3 bytes; a shorter final group produces fewer bytes, following the same math as [base64 decode](/util/base64_decode/).
4. The bytes are decoded as UTF-8 text, unless you ask for raw bytes.

```example
title: unpadded url-safe base64
input: aGVsbG8gd29ybGQ
output: hello world
```

### Accepting both alphabets and either padding style

Because real-world Base64url shows up with and without padding, and sometimes with whitespace or the standard `+`/`/` characters mixed in from a system that wasn't careful, this decoder accepts all of it:

```example
title: = padding and embedded whitespace both work
input: aGVsbG8g d29ybGQ=
output: hello world
```

### Unicode text

```example
title: multi-byte utf-8 characters decode correctly
input: aMOpbGxvIOKckyDwn46J
output: héllo ✓ 🎉
```

### Raw bytes

Set **output** to `bytes` whenever the original data wasn't text: for instance, the raw signature bytes of a JWT, or a token that packs binary data rather than JSON:

```example
title: bytes output shows the decimal, hex, and text form together
params: {"output": "bytes"}
input: aGk
output: bytes[104, 105]
hex: [68, 69]
utf8: hi
```

## Options

- **output**: `text` (default) decodes the result as UTF-8; `bytes` returns the bytes untouched.

## Common uses

- Decoding the header and payload of a JWT to inspect its claims (see [JWT decode](/util/jwt_decode/)).
- Recovering data passed through a URL query parameter or path segment as Base64url.
- Accepting Base64 from sources that may or may not include padding, without needing to know in advance.

## Tips and pitfalls

- A **"lone trailing character"** error means the last group holds a single character (the length, after whitespace and padding are removed, leaves a remainder of 1 when divided by 4). That combination can never come from valid Base64, padded or not, so it's rejected outright.
- If decoding throws "not valid UTF-8", the original data was binary. Switch the output option to `bytes`.
- Decoding a JWT's payload (via [JWT decode](/util/jwt_decode/)) only reveals its contents; it does **not** verify the signature. Never trust a JWT's claims without verifying it against the issuer's key.
- Base64url is not encryption. It hides nothing, and no key is needed to reverse it.
