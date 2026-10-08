---
title: Quoted-Printable Encode: RFC 2045 Text to QP
description: Encode text or bytes as RFC 2045 quoted-printable, with =XX escapes, trailing-space protection and soft line wrapping.
---
## What is quoted-printable encoding?

Quoted-printable (RFC 2045 §6.7) is an encoding designed for text that's *mostly* printable ASCII but might contain a handful of bytes that aren't: an occasional accented letter, a non-breaking space, a binary byte. Rather than encoding everything (as [Base64](/util/base64_encode/) does), it leaves ordinary printable text readable and only escapes the bytes that need it as `=XX` (an equals sign and two uppercase hex digits). It's still used today mainly in MIME email bodies, where it lets a message stay mostly human-readable in a plain text viewer while still safely carrying any byte value.

## How it works

Each byte is either passed through literally or escaped:

- Printable ASCII (33–60 and 62–126) is written as-is. That deliberately excludes `=` (61), which always has to be escaped since it's the encoding's own escape character.
- Everything else (control characters, DEL (127), bytes above 127, and `=` itself) is written as `=XX`, the byte's value in two uppercase hex digits.
- A space or tab is written literally in the middle of a line, but escaped if it's the very last character of a line, since transports are allowed to strip trailing whitespace.
- Lines longer than the configured **line length** are broken with a soft line break: `=` followed by CRLF, which a decoder removes without treating it as a real line break.

```example
title: non-ASCII and the equals sign
input: café = caffeine?
output: caf=C3=A9 =3D caffeine?
```

`é` becomes its two UTF-8 bytes, each escaped (`=C3=A9`), and the literal `=` becomes `=3D`.

### Trailing whitespace is protected

```example
title: trailing whitespace is escaped, interior whitespace is not
input: end 
output: end=20
```

The trailing space here becomes `=20` so it survives a transport that trims trailing whitespace from lines; a space in the middle of a line is left alone.

### Hard line breaks are preserved exactly

A real line break in the input (a hard break) is kept exactly as it was. This tool doesn't need to touch it unless a line also needs wrapping:

```example
title: hard line breaks are preserved exactly
input:
line one
line two
output:
line one
line two
```

RFC 2045 defines a hard line break as CRLF. This tool keeps whatever the input used (LF, CRLF or a lone CR), so convert line endings to CRLF first if the receiving system is strict. Every CR and LF byte is treated as a line break this way, even in raw binary input, where RFC 2045 would require `=0D` / `=0A`; for binary data, Base64 is the safer choice.

### Long lines get a soft break

```example
title: long lines wrap with a soft break (= followed by CRLF)
params: {"lineLength": 10}
input: abcdefghijklmnopqrstuvwxyz
output-matches: ^abcdefghi=\r\njklmnopqr=\r\nstuvwxyz$
```

The soft break is always `=` followed by an actual CRLF, per RFC 2045, regardless of what line-ending style the rest of your input uses, and no `=XX` escape group is ever split across one.

### Raw bytes

This tool also accepts raw bytes directly (from a file, or an earlier pipeline step), encoding each one without any text decoding step first:

```example
title: raw bytes, including non-UTF-8 values
input-encoding: hex
input: 00 FF 3D
output: =00=FF=3D
```

## Options

- **line length**: the maximum length of each output line, including the soft-break `=`. Default `76`, the longest line RFC 2045 allows; minimum `4`, maximum `998` (the SMTP line limit), though anything above 76 is outside the quoted-printable spec. One character of every line is reserved for the trailing `=`, so the actual content per line is one less than this value.

## Common uses

- Encoding MIME email bodies (`Content-Transfer-Encoding: quoted-printable`) that need to carry non-ASCII text through 7-bit-only mail transports.
- Producing mostly-readable ASCII-armored text for a payload that's usually plain text but occasionally has a stray non-ASCII byte.
- Testing or debugging email content that arrives quoted-printable encoded.

## Tips and pitfalls

- To reverse this, use [quoted-printable decode](/util/quoted_printable_decode/), which removes the soft breaks and resolves `=XX` escapes back to the original bytes or text.
- If you need every byte encoded uniformly, with no readable passthrough, [Base64 encode](/util/base64_encode/) is usually a better fit. Quoted-printable is at its best when most of the content is already plain ASCII.
- Because a decoder strips a line's soft `=` and joins it with the next, the exact **line length** you pick doesn't change the decoded result. It only affects how the encoded text is wrapped for transport.
- An out-of-range **line length** (below 4 or above 998) throws rather than silently clamping.
