---
title: Base85 Decode Online — Ascii85 & Z85 Decoder
description: Decode Ascii85, Z85, or RFC 1924 Base85 to text or raw bytes online, handling <~ ~> delimiters, whitespace, and the z zero-group shortcut.
---
## What is Base85 decoding?

This reverses [base85 encode](/util/base85_encode/): it takes a Base85 string in the Ascii85, Z85, or RFC 1924 alphabet and recovers the original text or bytes. Base85 packs 4 bytes into 5 characters, so decoding reads 5 characters at a time and converts them back into a 32-bit number, then into 4 bytes.

## How it works

1. `<~` / `~>` delimiters, if present, and any whitespace are stripped.
2. Each group of 5 characters is looked up in the chosen alphabet and combined into one base-85 number: `value = value * 85 + digit`.
3. That number is split back into 4 bytes, most significant byte first.
4. A short final group (2–4 leftover characters) is padded with the alphabet's highest digit, decoded the same way, and trimmed to `size − 1` bytes.
5. The bytes are decoded as UTF-8 text, unless you ask for raw bytes.

```example
title: the classic Ascii85 reference sentence
input: 9jqo^BlbD-BleB1DJ+*+F(f,q
output: Man is distinguished
```

### Delimiters and whitespace

Adobe's `<~ ~>` wrapper and any embedded whitespace (useful when the data has been wrapped across lines) are both tolerated automatically:

```example
title: delimiters and an embedded line break are both stripped
input:
<~9jqo^Blb
  D-BleB1DJ+*+F(f,q~>
output: Man is distinguished
```

### Z85 and other variants

Set **variant** to match how the value was encoded. Each alphabet assigns different characters to the same 85 values, so the wrong variant produces wrong bytes or an outright error:

```example
title: decoding a Z85 value to raw bytes
params: {"variant": "z85", "output": "bytes"}
input: xK#0@zV
output:
bytes[104, 101, 108, 108, 111]
hex: [68, 65, 6c, 6c, 6f]
utf8: hello
```

```example
title: rfc1924's alphabet decodes back to the same text
params: {"variant": "rfc1924"}
input: Xk~0{Zv
output: hello
```

### The `z` and `y` shortcuts

In the **ascii85** variant, a `z` between groups expands to four `0x00` bytes — the inverse of the encoder's `z` shortcut for all-zero groups. A `y` expands to four `0x20` (space) bytes; that is an extension from the old `btoa` tool, which [base85 encode](/util/base85_encode/) never emits but this decoder accepts. Either letter in the middle of a 5-character group is an error. In Z85 and RFC 1924, `z` and `y` are ordinary data characters instead, since those alphabets include them as regular digits.

```example
title: y expands to four spaces before the rest of the data
input: yBOu!rDZ
output:
    hello
```

## Options

- **variant** — `ascii85` (default), `z85`, or `rfc1924`. Must match the encoder.
- **output** — `text` (default) decodes the bytes as UTF-8; `bytes` returns them untouched.

## Common uses

- Extracting binary data embedded in a PostScript or PDF file's Ascii85 stream.
- Decoding ZeroMQ keys and short binary values encoded as Z85.
- Round-tripping data through [base85 encode](/util/base85_encode/) in a pipeline.

## Tips and pitfalls

- A group of 5 characters that decodes to a number larger than 2³² − 1 is not valid Base85 and is rejected with a "group overflows 32 bits" error, rather than silently truncated.
- A single leftover character at the end ("truncated" data) can never be valid — a real final group always has at least 2 characters.
- Short final groups are accepted in every variant, including Z85, whose strict specification only defines whole 5-character groups.
- `<~` and `~>` are only stripped as a matched pair in RFC 1924, because `<`, `>`, and `~` are ordinary digits in that alphabet; a real payload can legitimately start or end with what looks like half a delimiter.
- If decoding throws "not valid UTF-8", the original data was binary — switch the output option to `bytes`.
