---
title: Base64 Decode Online — Base64 to Text Converter
description: Decode standard Base64 to plain text online, with correct UTF-8 handling for accented letters and emoji, and an error instead of garbled output.
---
## What is Base64 decoding?

This reverses [base64 encode](/util/base64_encode/): it takes a Base64 string — four characters at a time from the alphabet `A–Z`, `a–z`, `0–9`, `+`, `/`, with `=` padding — and recovers the original text. Base64 exists so binary data can travel safely through text-only channels (email, JSON, URLs, HTTP headers); decoding is the last step that turns that safe text back into the real content.

## How it works

1. Each group of four Base64 characters is looked up in the alphabet to get four 6-bit values (24 bits total).
2. Those 24 bits are regrouped into three 8-bit bytes.
3. `=` padding characters mark a short final group and are stripped rather than decoded.
4. The resulting bytes are decoded as UTF-8 text.

```example
title: padding marks a short final group — aGk= is two bytes
input: aGk=
output: hi
```

```example
title: a longer string
input: aGVsbG8gd29ybGQ=
output: hello world
```

### Unicode text

Because Base64 carries bytes, not characters, this tool decodes the bytes as UTF-8 — the same encoding [base64 encode](/util/base64_encode/) uses to produce them — so accented letters, symbols, and emoji come back intact:

```example
title: a multi-byte UTF-8 character
input: 4pyT
output: ✓
```

Missing padding and embedded whitespace are both accepted:

```example
title: unpadded, with a space in the middle
input: aGVsbG8g d29ybGQ
output: hello world
```

Empty input decodes to an empty string:

```example
title: empty input
input:
output:
```

## Common uses

- Reading the payload embedded in a `data:` URI, an email attachment, or an HTTP Basic Authorization header.
- Recovering plain text that was Base64-encoded for storage in JSON, YAML, or an environment variable.
- Verifying that a value produced by [base64 encode](/util/base64_encode/) round-trips correctly.

## Tips and pitfalls

- This tool only recognizes the **standard** alphabet (`+` and `/`). If your input uses `-` and `_` instead, use [base64url decode](/util/base64url_decode/), which accepts both alphabets and can also return raw bytes.
- Padding is optional — `aGk` decodes the same as `aGk=` — but if `=` is present it must be the right amount: `YQ=` is rejected, while `YQ` and `YQ==` both decode to `a`.
- If the decoded bytes are not valid UTF-8 — for example, a Base64 string that actually holds a compressed file or an image — decoding fails outright rather than returning corrupted text or replacement characters. That is deliberate: silently mangling binary data as text would be worse than an explicit error.
- Spaces, tabs and line breaks anywhere in the input are ignored, so wrapped Base64 (as in MIME email) decodes as-is. Any other character outside the alphabet, including an `=` in the middle, makes decoding fail.
- Base64 is not encryption. Decoding requires no key or password, so never rely on it to keep data secret.
