---
title: Morse Code Decoder — Translate Morse Code to Text
description: Decode Morse code back to text, tolerating middot symbols, slash or pipe word gaps, and passing unrecognized characters through unchanged.
---
## What is Morse code decoding?

This tool reverses [morse encode](/util/morse_encode/): it reads dots and dashes and turns them back into letters, digits and punctuation — the international Morse code standard (ITU-R M.1677-1) plus common non-ITU codes such as `!` and `&` — along with accented Latin letters and multi-letter **prosigns** like `<SOS>` and `<SK>`, which it writes back as `<NAME>`. Letters always come back in upper case, since Morse has no case.

## How it works

Give it Morse tokens separated by spaces, with words separated by a wider gap, and it looks each token up in the Morse table.

```example
title: decode a word
input: .... . .-.. .-.. ---
output: HELLO
```

```example
title: multiple words
input: .... . .-.. .-.. --- / .-- --- .-. .-.. -..
output: HELLO WORLD
```

Word gaps are recognized flexibly: a slash or pipe (or a run of them) with any surrounding spaces, as above, or three or more whitespace characters in a row, both count as a word boundary.

```example
title: three spaces work as a word gap too
input: ... --- ...   .... ..
output: SOS HI
```

### Symbol variants

Not everyone types dots and dashes with the literal `.` and `-` characters. This tool also recognizes the common look-alikes: middle dots (`·`, `•`, `∙`, `・`) as dots, and en/em dashes, the horizontal bar, minus signs and underscores as dashes.

```example
title: middot and dash-like symbols
input: ···· · ·—·· ·—·· ———
output: HELLO
```

### Codes that are not real Morse

When a token is not in the table but is made only of dots and dashes, it is treated as a genuine but unrecognized Morse sequence and raises an error, since it was clearly meant to be Morse and could not be decoded. A token that is not made of dots and dashes at all — ordinary text mixed into the input — is passed through unchanged instead of being rejected, which lets literal characters (like an emoji or a stray word) survive a round trip through [morse encode](/util/morse_encode/) with its `keep` option. The exception is the dot and dash look-alikes listed above: they are always read as Morse symbols, so a kept `—` comes back as the letter `T`.

```example
title: non-Morse tokens pass through unchanged
input: .- € -...
output: A€B
```

Some Morse codes are shared between a real character and a prosign — `.-.-.` is both the plus sign and the `<AR>` (end of message) prosign, and `-...-` is both `=` and `<BT>`. Whenever there is a conflict, this tool prefers the plain character, so `.-.-.` decodes to `+`; only codes no character claims come out as a prosign, such as `...---...` for `<SOS>`.

## Common uses

- Translating received or copied Morse code — from radio logs, puzzles, or historical transcripts — back into readable text.
- Verifying that a message produced by [morse encode](/util/morse_encode/) decodes back to the original text.
- Reading Morse written with non-standard dot/dash symbols, such as bullet points or en dashes used for formatting reasons.
- Building simple encode/decode learning tools or puzzle generators.

## Tips and pitfalls

- Morse code is a public, standardized encoding, not a cipher — treat it purely as a format conversion, not as a way to hide information.
- Line breaks in the input are decoded line by line and preserved in the output, matching how [morse encode](/util/morse_encode/) keeps line structure on the way out.
- An unrecognized run of pure dots and dashes (for example, one with too many dots for any letter) throws an error naming the bad sequence, rather than guessing or dropping it silently.
- If your Morse uses a different separator convention than spaces and slashes, normalize it first — for example with a find-and-replace step — since only slash, pipe and wide-space gaps are recognized as word boundaries.
