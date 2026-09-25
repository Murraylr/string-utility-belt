---
title: Quoted-Printable Decode — Decode RFC 2045 QP Text
description: Decode RFC 2045 quoted-printable text or email bodies, undoing =XX escapes and soft line breaks, to text or raw bytes.
---
## What does decoding quoted-printable do?

Quoted-printable (RFC 2045 §6.7) is an encoding used mainly in MIME email that keeps ordinary printable text readable while escaping anything that isn't as `=XX` (an equals sign followed by two hex digits for that byte's value), and wraps long lines with a soft line break (`=` at the end of a line) that isn't part of the actual content. This tool is the counterpart to [quoted-printable encode](/util/quoted_printable_encode/): it resolves the `=XX` escapes back to bytes, removes the soft line breaks, and gives you back the original text — or, with the `bytes` output, the raw bytes (needed when the content isn't valid UTF-8).

## How it works

The tool reads the input line by line. On each line, a trailing `=` means a soft break — that `=` and the line ending after it are removed entirely, joining this line directly onto the next. Any `=XX` elsewhere in the line is replaced with the byte it represents.

```example
title: hex escape
input: Caf=C3=A9
output: Café
```

### Soft breaks disappear; hard breaks stay

A soft line break (content ending in `=`) is invisible in the decoded result — the two lines it joins become one, with no line break at all. A real (hard) line break, one that wasn't inserted just to wrap the encoding, is kept:

```example
title: keeps hard line breaks but removes soft ones
input:
abc=
def
ghi
output:
abcdef
ghi
```

Here `abc=` joins directly onto `def` (the soft break vanishes along with its own line ending), while the line break between `def` and `ghi` is a real one and survives.

```example
title: a soft break can be followed directly by more content
input:
Line one=
still line one
output: Line onestill line one
```

### Raw bytes instead of text

By default the decoded bytes are interpreted as UTF-8 text. Setting **output** to `bytes` returns the raw `Uint8Array` instead — useful for content that isn't necessarily text, or that isn't valid UTF-8:

```example
title: output as raw bytes instead of text
params: {"output": "bytes"}
input: =C3=A9
output:
bytes[195, 169]
hex: [c3, a9]
utf8: é
```

### Literal non-ASCII is tolerated

Real quoted-printable data should only contain a restricted set of ASCII characters, with everything else escaped. This decoder is lenient about text that was pasted in with literal non-ASCII characters anyway — including characters outside the Basic Multilingual Plane, which stay whole rather than being split into broken surrogate halves:

```example
title: literal non-ASCII pasted directly is tolerated
input: a😀b
output: a😀b
```

## Options

- **output** — `text` (default): decode the result as UTF-8 and return a string, throwing if the bytes aren't valid UTF-8. `bytes`: return the raw decoded bytes instead, which always succeeds regardless of content.

## Common uses

- Reading the actual content of a MIME email body that arrived with `Content-Transfer-Encoding: quoted-printable`.
- Reversing output from [quoted-printable encode](/util/quoted_printable_encode/).
- Recovering binary or non-UTF-8 data that was quoted-printable encoded, using the `bytes` output option.
- Cleaning up quoted-printable artifacts (`=C3=A9`, trailing `=` line wraps) left over in text copied from an email client or mailbox export.

## Tips and pitfalls

- An `=` not followed by two valid hex digits (and not at the very end of a line, where it means a soft break) throws an error — it isn't a valid escape.
- In `text` mode, decoded bytes that aren't valid UTF-8 throw an error telling you to switch **output** to `bytes`; in `bytes` mode, any byte sequence is accepted.
- Text mode only understands UTF-8. An email body in a legacy charset — `charset=iso-8859-1`, where `é` is `=E9` — fails there; decode it to `bytes` and pass those to [charset decode](/util/charset_decode/) with the matching charset.
- Trailing spaces and tabs on a line are treated as transport padding and stripped before decoding, unless they were themselves escaped as `=20` / `=09` by the encoder — that's how [quoted-printable encode](/util/quoted_printable_encode/) protects real trailing whitespace from being lost in transit.
- To go the other direction, use [quoted-printable encode](/util/quoted_printable_encode/). For a denser, uniformly-encoded alternative that doesn't try to stay readable, see [Base64 decode](/util/base64_decode/).
