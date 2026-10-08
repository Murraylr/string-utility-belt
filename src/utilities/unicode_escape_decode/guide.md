---
title: Unicode Unescape: Decode \u, CSS & HTML Escapes
description: Decode \uXXXX, \u{...}, \xNN, \U escapes plus CSS and HTML entity escapes back to text, all in a single pass.
---
## What does this tool decode?

Different languages and formats spell a Unicode escape differently: JavaScript and Java write `\uXXXX` (JavaScript also has the ES2015 `\u{...}` brace form), Python adds `\UXXXXXXXX` for characters outside the Basic Multilingual Plane, byte escapes look like `\xNN`, CSS uses a bare `\` followed by hex digits and a trailing space, and HTML uses `&#DEC;` or `&#xHEX;` numeric entities. This tool is the single decoder for all of them, the counterpart to [unicode escape](/util/unicode_escape_encode/). It recognizes every one of these forms in the same pass and converting each back to the character it represents. Anything that isn't a recognized escape, including plain text and other backslash sequences such as `\n` or `\d`, is left untouched.

## How it works

The tool scans the input once, matching the longest and most specific escape form first so that, for example, `\u{1F600}` is read as one brace escape rather than as `\u` followed by stray text. The forms it recognizes:

| form | example | meaning |
| --- | --- | --- |
| `\u{HEX}` | 1–6 hex digits in braces | ES2015 brace escape |
| `\uXXXX` | exactly 4 hex digits | classic JavaScript / Java escape |
| `\UXXXXXXXX` | exactly 8 hex digits | Python wide escape |
| `\xNN` | exactly 2 hex digits | byte escape |
| `\NNNNNN` (+ optional space) | 2–6 hex digits | CSS escape |
| `\N` (+ required space) | a single hex digit | CSS escape, single-digit form |
| `&#xHEX;` | hex digits | HTML hex entity |
| `&#DEC;` | decimal digits | HTML decimal entity |

```example
title: classic \uXXXX escapes (JavaScript, Java, JSON)
input: \u0041\u0042\u0043
output: ABC
```

A four-digit `\uXXXX` escape can only reach U+FFFF, so JavaScript, Java and JSON write an astral character (outside the Basic Multilingual Plane) as a UTF-16 surrogate pair: two escapes in a row. The decoder recombines the pair into the single character it represents:

```example
title: a surrogate pair decodes to one character
input: \ud83d\ude00
output: 😀
```

The ES2015 brace form needs only one escape for the same character:

```example
title: an astral character decodes as a single unit
input: \u{1F600}
output: 😀
```

### HTML entities

```example
title: HTML entities
input: &#x1F600; &#128512;
output: 😀 😀
```

### Byte and Python-style escapes

```example
title: byte and python wide escapes
input: \xe9 \U0001f600
output: é 😀
```

### Mixing styles in a single pass

Because every form is recognized in the same scan, text with a mixture of escape styles (from copy-pasting fragments out of different tools) decodes correctly in one call:

```example
title: mixing escape styles in one pass
input: Hi\xe9 &#x1F600; \u{21}
output: Hié 😀 !
```

### What is left alone

Backslash sequences that aren't built from hex digits (`\n`, `\d`, `\w`, `\q`) are never touched, and neither are named HTML entities such as `&amp;` (use [HTML entity decode](/util/html_entity_decode/) for those):

```example
title: unrecognized escapes and plain text are left alone
input: line\nbreak \d+ \w \q
output: line\nbreak \d+ \w \q
```

The CSS form is the catch: a backslash followed by two or more hex digits (`0`–`9`, `a`–`f`) is always read as a CSS escape, even when it was never meant as one. Windows paths and regular expressions are the usual victims. Here `\da` is read as U+00DA (`Ú`), followed by the plain text `ta`:

```example
title: a backslash before hex digits is read as a CSS escape
input: C:\data
output: C:Úta
```

## Common uses

- Reading the actual text behind Unicode-escaped strings copied from JavaScript, Python, Java, or CSS source, or from JSON/log output that shows `\u` escapes instead of characters.
- Decoding HTML numeric character references pulled from markup or feeds, without needing a separate tool for the entity forms.
- Normalizing text that arrived through several tools and ended up with a mixture of escape styles.
- Recovering readable Unicode text (emoji, CJK, accented letters) from ASCII-safe escaped representations.

## Tips and pitfalls

- A reference to a code point beyond U+10FFFF (for example `\u{110000}`) throws an error rather than producing invalid output, since no such character exists.
- `\xNN` is read as the code point U+00NN, not as a UTF-8 byte, so escaped UTF-8 bytes such as Python's `\xc3\xa9` decode to `Ã©`, not `é`.
- Because this decoder recognizes several styles at once, only run it over text that is meant to contain escapes: a stray backslash followed by hex digits, or a literal `&#38;`, is decoded like any other escape.
- To go the other direction (producing any one of these escape styles from plain text), use [unicode escape](/util/unicode_escape_encode/), which lets you choose the style and whether to escape only non-ASCII characters or everything.
- If you want a plain list of code points (`U+0048 U+0069`) rather than inline escapes to decode, see [from code points](/util/codepoints_decode/) and its encoder [to code points](/util/codepoints_encode/) instead.
