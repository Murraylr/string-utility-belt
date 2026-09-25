---
title: Unicode Escape Online — \u, CSS, Python & HTML Styles
description: Escape characters as \uXXXX, \u{...}, CSS, Python, Java or HTML entity escapes, for non-ASCII text or every character.
---
## What is a Unicode escape?

A Unicode escape writes a character by its code point instead of as the literal character itself — `\u00e9` instead of `é`, or `&#233;` instead of the same character as an HTML entity. Different languages and formats use different escape syntaxes for this, and this tool produces seven of the common ones: JavaScript/Java's classic `\uXXXX`, the ES2015 `\u{...}` brace form, CSS's backslash-hex escape, Python's `\u`/`\U` forms, and HTML's decimal and hex numeric entities.

It exists for the cases where you need ASCII-safe or format-specific text: embedding non-Latin text in a system that mangles raw UTF-8, generating test data with predictable escapes, or converting between escape styles.

## How it works

Pick a **style** and a **scope**. The tool then walks the text one Unicode code point at a time (so an emoji is never split into broken halves) and escapes whatever the scope calls for.

```example
title: non-ASCII, default style
input: café 日本語
output: caf\u00e9 \u65e5\u672c\u8a9e
```

With **scope** set to `all`, every character is escaped, including plain ASCII letters — here in the CSS style, where each escape ends in a delimiting space:

```example
title: every character, CSS style
params: {"style": "css", "scope": "all"}
input: Hi!
output: \48 \69 \21 
```

### Astral characters

Characters outside the Basic Multilingual Plane (most emoji) are escaped as a single unit, in whatever form the style calls for. The classic `\uXXXX` style (and Java's) has no way to address code points above U+FFFF directly, so it falls back to a UTF-16 surrogate pair — two escapes that together represent one character, exactly as JavaScript strings store it internally:

```example
title: astral characters become a UTF-16 surrogate pair
input: 😀
output: \ud83d\ude00
```

The brace form `\u{...}`, Python's `\U`, CSS and the HTML styles instead write the whole code point as one escape (`\u{1f600}`, `\U0001f600`, `\1f600 `, `&#128512;`).

### The escape delimiters are always escaped

Whichever scope you choose, a literal backslash (`\`) or ampersand (`&`) in the input is always escaped, even under the `non-ascii` scope where ASCII text is normally left alone:

```example
title: the escape delimiters \ and & are always escaped
input: C:\temp
output: C:\u005ctemp
```

This matters because [unicode escape decode](/util/unicode_escape_decode/) resolves every style in a single pass. If a literal `\` or `&` were left alone, text that already looks like an escape — a literal `\e9 ` or `&#233;` in the input — would decode to `é` instead of coming back as typed.

## Options

- **style** — `js-u` (default, `\uXXXX`), `js-braces` (`\u{...}`), `css` (`\hex `), `python` (`\uXXXX` / `\UXXXXXXXX`), `java` (`\uXXXX`, same UTF-16 rules as `js-u`), `html-hex` (`&#xHEX;`), or `html-dec` (`&#DEC;`).
- **scope** — `non-ascii` (default) escapes everything above U+007F plus `\` and `&`; `all` escapes every character, control characters and whitespace included.

```example
title: the HTML styles produce entities
params: {"style": "html-hex"}
input: é
output: &#xe9;
```

## Common uses

- Producing ASCII-safe text for systems, protocols, or older encodings that can't carry raw UTF-8.
- Embedding non-Latin or symbol text in CSS (`content: "\e9"`-style escapes), JavaScript, Python, or HTML source.
- Generating test fixtures with a specific, predictable escape style for byte-for-byte comparison.
- Converting between escape conventions when porting text or code between languages.

## Tips and pitfalls

- To reverse this encoding, use [unicode escape decode](/util/unicode_escape_decode/), which recognizes all seven styles (plus a couple of close relatives like `\xNN`) in a single pass and needs no style or scope option of its own.
- For a simpler listing of code points rather than an escaped string you'd paste into code, see [to code points](/util/codepoints_encode/), which formats each character as `U+XXXX`, hex, decimal, or `\u{...}` with a custom separator instead of inline escaping.
- If you specifically need JSON- or JavaScript-string-safe escaping (quotes, backslashes, and control characters, not just Unicode), use [JSON escape](/util/json_escape/) or [code string escape](/util/code_string_escape/) instead.
- CSS escapes end in a delimiting space so the parser knows where the hex digits stop — that trailing space is part of the escape and is significant if you're pasting the result into a stylesheet.
- Java translates `\u` escapes before it parses string literals, so the `java` style's escapes are not all safe inside a Java string: the `\u005c` written for a backslash turns back into an escape character, and under `scope: all` the escapes for a newline or `"` break the literal. For Java string literals, use [code string escape](/util/code_string_escape/) with the `java` language instead.
