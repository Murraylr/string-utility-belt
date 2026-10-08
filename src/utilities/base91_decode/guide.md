---
title: basE91 Decode Online: Base91 to Text Converter
description: Decode basE91 (Base91) text back to plain text or raw bytes online, ignoring line breaks and other whitespace.
---
## What is basE91 decoding?

This reverses [basE91 encode](/util/base91_encode/): it takes a basE91 string and recovers the original text or raw bytes. basE91 packs data using a running bit queue rather than fixed-size groups, so decoding rebuilds that same queue one input character at a time and drains complete bytes from it as they become available.

## How it works

1. Whitespace (including line breaks) is stripped.
2. Characters are consumed two at a time; each pair combines into one value: `value = first + second * 91`.
3. That value is merged into a running bit queue, contributing either 13 or 14 bits depending on its size. This mirrors exactly how the encoder decided how many bits to take.
4. Whenever the queue holds a full byte (8 bits), it's emitted, and the queue keeps the leftover bits for the next pair.
5. The resulting bytes are decoded as UTF-8 text, unless you ask for raw bytes.

```example
title: decode back to text
input: fPNKd
output: test
```

Line breaks or other whitespace inside the input are ignored, which is handy when a long basE91 string has been wrapped for readability:

```example
title: an embedded line break is ignored
input: TPwJh>Io
2Tv!lE
output: hello world
```

### Raw bytes and Unicode

```example
title: bytes output shows the decimal, hex, and text form together
params: {"output": "bytes"}
input: GB
output: bytes[97]
hex: [61]
utf8: a
```

```example
title: unicode text
input: 1J_OX<oC*n1bnBW4@aE
output: héllo ✓ 🎉
```

## Options

- **output**: `text` (default) decodes the bytes as UTF-8; `bytes` returns them untouched, which is necessary for any data that wasn't text to begin with.

## Common uses

- Recovering the original value from a basE91 string found in a config file, shell script, or source literal.
- Round-tripping data through [basE91 encode](/util/base91_encode/) in a pipeline.
- Comparing the same underlying bytes against other encodings, such as [base85 decode](/util/base85_decode/) or [base64 decode](/util/base64_decode/).

## Tips and pitfalls

- basE91 never produces an apostrophe, backslash, or hyphen, so any of those characters (or any non-ASCII character) in your input means it isn't valid basE91 and decoding will fail. Whitespace, by contrast, is stripped wherever it appears.
- If decoding throws "not valid UTF-8", the original data was binary. Switch the output option to `bytes`.
- This tool has no alphabet or variant option: there is exactly one basE91 alphabet, unlike [base32 decode](/util/base32_decode/) or [base85 decode](/util/base85_decode/).
