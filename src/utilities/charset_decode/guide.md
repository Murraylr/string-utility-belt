---
title: Charset Decode Online — Windows-1252, Shift_JIS & More
description: Decode raw bytes or mojibake text into readable text using a legacy charset such as windows-1252, iso-8859-1, shift_jis or koi8-r.
---
## What is a charset decoder?

Text is stored as bytes, and a charset is the agreement on which bytes mean which characters. This tool reverses [charset encode](/util/charset_encode/): given bytes (or text that is really a byte view in disguise — see below), it decodes them using one of fourteen charsets, from the near-universal `utf-8` and `utf-16` to legacy single-byte charsets (`windows-1252`, `iso-8859-1`, `iso-8859-15`, `windows-1251`, `koi8-r`, `macintosh`) and East Asian multi-byte charsets (`shift_jis`, `euc-jp`, `euc-kr`, `gbk`, `big5`). The default charset is `windows-1252`.

## How it works

Feed this tool actual bytes — from a file, or from a previous step such as [get bytes](/util/get_bytes/) — and it decodes them using the charset you pick.

```example
title: windows-1252 accented bytes
input-encoding: hex
input: e9e8
output: éè
```

```example
title: bytes in the windows-1252 high range
input-encoding: hex
params: {"charset": "windows-1252"}
input: 80 92 e9
output: €’é
```

The bytes `0x80` and `0x92` are not the Unicode code points U+0080 and U+0092 in `windows-1252` — Windows reassigned that whole range (0x80–0x9F) to punctuation and symbols like `€` and curly quotes. `windows-1252` and `iso-8859-1` only disagree there; everywhere else they behave identically.

### Fixing mojibake pasted as text

If your **input is already a string** rather than raw bytes, this tool treats each character with a code point of 0xFF or below as if it were literally that one byte — the classic "read UTF-8 bytes through a Latin-1 lens" repair. That is what makes it able to fix mojibake pasted straight into a text box, not just real byte input:

```example
title: repairing mojibake pasted as text
input: cafÃ©
params: {"charset": "utf-8"}
output: café
```

Here the five characters `c a f Ã ©` are read as the five raw bytes `63 61 66 c3 a9`, which are exactly the valid UTF-8 encoding of `café` — so decoding them as UTF-8 recovers the original text. Characters above U+00FF in the input (real Unicode, not stand-ins for bytes) fall back to their own UTF-8 bytes instead, so they survive a `utf-8` decode intact; with any other charset those bytes are decoded like the rest, which turns them into mojibake.

```example
title: a multi-byte East Asian charset
input-encoding: hex
params: {"charset": "shift_jis"}
input: 82a0
output: あ
```

## Options

- **charset** — one of `utf-8`, `utf-16le`, `utf-16be`, `windows-1252`, `iso-8859-1`, `iso-8859-15`, `windows-1251`, `koi8-r`, `shift_jis`, `euc-jp`, `euc-kr`, `gbk`, `big5` or `macintosh`. Defaults to `windows-1252`.
- **error on invalid bytes** — off by default, which means malformed sequences are replaced with the Unicode replacement character (U+FFFD) instead of failing the whole decode. Turn it on to catch corrupted or mis-labeled input instead of silently getting `�` in the middle of your text. It has no effect on `windows-1252`, `iso-8859-1` and `iso-8859-15`, which map all 256 byte values and so can never fail.

## Common uses

- Recovering readable text from a file whose original encoding is known but was decoded incorrectly ("mojibake") elsewhere.
- Reading legacy database exports, email bodies or log files that predate universal UTF-8 adoption.
- Verifying, byte for byte, what a [charset encode](/util/charset_encode/) step in an earlier pipeline actually produced.
- Decoding non-UTF-8 payloads pulled out of a [data URI parse](/util/data_uri_parse/) step with a matching charset label.

## Tips and pitfalls

- `windows-1252`, `iso-8859-1` and `iso-8859-15` are decoded from fixed lookup tables rather than the platform's built-in `TextDecoder`, because runtimes disagree on them: the WHATWG Encoding Standard that browsers follow treats the label `iso-8859-1` as `windows-1252`, and some Node versions decode `windows-1252` as plain Latin-1, either of which would silently change the 0x80–0x9F range. The other charsets go through the runtime's `TextDecoder`.
- Decoding as `utf-8`, `utf-16le` or `utf-16be` drops a matching leading byte order mark, so a file that starts with one comes back without it.
- Empty input always decodes to an empty string, regardless of charset.
- If the text looks correct except for a handful of stray `€`-like symbols or curly quotes turning into odd characters, you are very likely looking at `windows-1252` text that was decoded as `iso-8859-1` (or vice versa) — try switching between the two.
- When you are not sure what produced a piece of garbled text, [unicode inspect](/util/unicode_inspect/) will show you the exact code points involved, which makes it easier to guess the original charset.
