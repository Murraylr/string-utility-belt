---
title: basE91 Encode Online — Text to Base91 Converter
description: Encode text or bytes as basE91 online, a denser printable-ASCII encoding than Base64 that avoids spaces, apostrophes, hyphens and backslashes.
---
## What is basE91 encoding?

basE91 (also written Base91) is a denser alternative to [base64 encode](/util/base64_encode/): it uses 91 printable ASCII characters instead of 64, so it needs fewer characters to represent the same bytes — roughly **23% overhead** for typical data (as little as about 14% for input made mostly of zero bits) instead of Base64's 33%. The alphabet is every printable ASCII character except the apostrophe (`'`), the backslash (`\`), and the hyphen (`-`), and it never produces a space, so the result can go inside a single-quoted shell string without extra escaping. It does include the double quote (`"`), so a double-quoted string, such as a C or JSON string literal, still needs escaping. basE91 was designed by Joachim Henke as a denser sibling to Base64 — it is not an IETF standard the way Base32 and Base64 are (RFC 4648).

## How it works

basE91 doesn't work on fixed-size byte or bit groups the way Base64 and Base32 do. Instead it keeps a running queue of bits and drains 13 or 14 bits at a time into two output characters:

1. Text is converted to UTF-8 bytes first; raw bytes (including values above 0x7F) are used as-is.
2. Each input byte's 8 bits are added to a bit queue.
3. Whenever the queue holds more than 13 bits, the low 13 bits are examined: if their value is above 88 those 13 bits are pulled off, otherwise 14 bits are taken. Either way the value (under 91 × 91 = 8281) is written as two base-91 digits.
4. Any bits left over at the end are flushed as one final digit, plus a second if there are enough of them.

```example
title: 11 bytes become 14 characters
input: hello world
output: TPwJh>Io2Tv!lE
```

### Raw bytes, including values above 0x7F

Because basE91 operates on bytes, not text, it round-trips raw binary data exactly — including bytes above 0x7F that would need explicit UTF-8 handling elsewhere:

```example
title: raw bytes are encoded exactly, byte for byte
input-encoding: hex
input: 0001027f80c8fdfeff
output: :C#(h",^_~#
```

### Empty input and Unicode text

```example
title: unicode text is encoded as utf-8 bytes first
input: héllo ✓ 🎉
output: 1J_OX<oC*n1bnBW4@aE
```

```example
title: empty input
input:
output:
```

## Common uses

- Embedding binary data where apostrophes, backslashes or hyphens are awkward, such as single-quoted shell arguments.
- A denser alternative to Base64 (the receiving side needs a basE91 decoder) when the extra ~10 percentage points of density matter, for example in constrained message formats.
- Comparing encoding density against [base64 encode](/util/base64_encode/) (33% larger) or [base85 encode](/util/base85_encode/) (about 25% larger).

## Tips and pitfalls

- This tool has no configurable options — there is only one basE91 alphabet, unlike [base32 encode](/util/base32_encode/) or [base85 encode](/util/base85_encode/), which support multiple variants.
- basE91 is an encoding, not encryption or compression. It hides nothing, and the output is always larger than the input — only less so than with Base64.
- To recover the original text or bytes, use [basE91 decode](/util/base91_decode/).
