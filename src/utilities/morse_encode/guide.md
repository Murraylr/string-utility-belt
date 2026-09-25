---
title: Morse Code Translator — Text to Morse Code Online
description: Convert text to Morse code with letters, digits, punctuation, accented characters and prosigns like SOS, with custom letter and word separators.
---
## What is Morse code?

Morse code represents letters, digits and punctuation as sequences of short and long signals — dots and dashes — originally designed for operators sending text over the electric telegraph and later used by radio. Letters, digits and the core punctuation follow the international Morse code standard (ITU-R M.1677-1): `A` is `.-`, `E` is `.`, and so on. The table also includes common codes the ITU standard does not define — `!`, `&`, `;`, `_` and `$` — a range of accented Latin letters, and the multi-letter signals called **prosigns**, written as `<NAME>` in the input: `<SOS>`, `<AR>` (end of message), `<SK>` (end of contact), `<AS>`, `<BT>`, `<BK>`, `<CT>`, `<KA>`, `<KN>`, `<SN>`, `<VE>`, `<VA>`, `<INT>`, `<NJ>` and `<HH>` (names are case-insensitive).

## How it works

Text is split into words, and each word into individual characters, which are looked up in the Morse table and joined with a **letter separator**. Words are then joined with a **word separator**.

```example
title: default separators
input: HELLO WORLD
output: .... . .-.. .-.. --- / .-- --- .-. .-.. -..
```

```example
title: the word SOS, letter by letter
input: SOS
output: ... --- ...
```

Typed as plain letters, `SOS` becomes three separate letters with gaps between them. The distress signal is really one unbroken prosign, which you get by writing it as `<SOS>`:

```example
title: the SOS prosign, sent as one run
input: <SOS>
output: ...---...
```

Letters are matched case-insensitively — `sos` and `SOS` encode the same way — and digits and common punctuation are supported too:

```example
title: digits and punctuation
input: 911!
output: ----. .---- .---- -.-.--
```

### Custom separators

The **letter separator** and **word separator** options control the text between tokens, so you can match whatever convention a downstream tool expects.

```example
title: custom separators
params: {"letterSeparator": "|", "wordSeparator": "_"}
input: AB CD
output: .-|-..._-.-.|-..
```

### Characters with no Morse equivalent

Not every character has an assigned Morse code — emoji and most symbols outside the standard alphabet do not. The **unknown characters** option decides what happens to them: `skip` (the default) drops them silently, `keep` passes them through as their own token, and `error` stops the conversion.

```example
title: skip (the default) drops unsupported characters
input: a€b
output: .- -...
```

```example
title: keep passes them through unchanged
params: {"onUnknown": "keep"}
input: a€b
output: .- € -...
```

## Options

- **letter separator** — text placed between the Morse codes for individual letters. Defaults to a single space.
- **word separator** — text placed between words. Defaults to ` / ` (space, slash, space), a common way to write the word gap in text.
- **unknown characters** — `skip` (default, drop them), `keep` (pass them through as-is) or `error` (throw, naming the character and its code point).

## Common uses

- Learning or teaching Morse code by seeing text and its encoding side by side.
- Generating Morse output for ham radio practice, puzzles, or novelty projects (LED blinkers, buzzer scripts).
- Producing a reversible encoding of a short message for [morse decode](/util/morse_decode/) to translate back (letters come back in upper case).
- Encoding call signs or short phrases that include accented letters used in non-English Morse traditions.

## Tips and pitfalls

- This is a well-known, publicly documented code, not a cipher — anyone can decode it, including with this same tool run in reverse. Do not rely on it to hide information.
- Multi-line input is encoded line by line, and the line breaks are preserved in the output, so a message with paragraphs keeps its lines through [morse decode](/util/morse_decode/).
- [Morse decode](/util/morse_decode/) splits letters on whitespace and words on `/`, `|` or three or more spaces, so custom separators only decode back if they follow that shape — the `|`/`_` example above does not.
- A character like `ß`, which upper-cases to two letters (`SS`), expands into two Morse codes rather than failing or being skipped.
- If you need the reverse direction — Morse back to text, including tolerance for `·`/`—`-style symbols someone else's Morse used — see [morse decode](/util/morse_decode/).
