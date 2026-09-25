---
title: HTML Entity Encoder — Named, Decimal & Hex References
description: Convert text to HTML character references — named entities, decimal, or hex — with a minimal, non-ASCII, or all-characters scope.
---
## What is an HTML character reference?

An HTML character reference stands in for a character that would otherwise be ambiguous or unsafe inside markup — either because it has syntactic meaning (`<`, `&`) or because it isn't ASCII and might not survive every encoding a page passes through. There are two forms: named references like `&eacute;` (for `é`) and numeric references like `&#233;` or `&#xE9;` (the same character by its Unicode code point). This tool converts arbitrary text into either form, over a scope you choose — from the handful of characters that are unsafe in raw HTML to every character in the input.

Unlike [escape HTML](/util/escape_html/), which only ever escapes five fixed characters to a fixed set of named entities, this tool gives you named, decimal, or hex output and lets you widen the scope to also cover accented letters, symbols, and any other character outside ASCII.

## How it works

Two options control the output: **reference form** (`mode`) and **scope**.

### Reference form

- **named** (default) — looks up the character in a table of about 270 named entities (the HTML 4.01 set, `&apos;`, and a handful of HTML5 additions such as `&check;` and `&star;`) and emits `&name;`. HTML5 defines over 2,000 names; anything outside this table gets a numeric reference instead. Characters without a name fall back to a numeric reference.
- **decimal** — always emits `&#N;`, the character's Unicode code point in base 10.
- **hex** — always emits `&#xHEX;`, the code point in uppercase hexadecimal.

### Scope

- **minimal** — escapes only the five characters that are unsafe in HTML markup: `"`, `&`, `'`, `<`, `>`.
- **non-ascii** (default) — escapes the minimal set plus every character above U+007F.
- **all** — escapes every character, including plain ASCII letters and digits.

```example
title: named, non-ascii scope
input: café < 5 & "ok"
output: caf&eacute; &lt; 5 &amp; &quot;ok&quot;
```

```example
title: decimal, every character
input: café
params: {"mode": "decimal", "scope": "all"}
output: &#99;&#97;&#102;&#233;
```

Scope `minimal` leaves accented and non-Latin characters alone and only touches the five markup-unsafe characters:

```example
title: scope minimal only touches markup characters
params: {"scope": "minimal"}
input: Café & "x"
output: Café &amp; &quot;x&quot;
```

### When a character has no name

Under `mode: named`, a character that isn't in the named-entity table falls back to a numeric reference automatically, so emoji and other rare characters are still encoded correctly instead of being skipped:

```example
title: an emoji has no named entity, so it falls back to numeric
input: 😀
output: &#128512;
```

Characters outside the Basic Multilingual Plane are handled correctly too — the encoder walks Unicode code points, not UTF-16 units, so an emoji is escaped as one reference (`&#128512;`) rather than two broken surrogate halves. A multi-code-point sequence, such as an emoji with a skin-tone modifier, becomes one reference per code point.

## Options

- **reference form** (`mode`) — `named`, `decimal`, or `hex`. Default `named`.
- **scope** — `minimal`, `non-ascii`, or `all`. Default `non-ascii`.

A small number of code points — U+0000 and the C1 control range U+0080–U+009F — are passed through as literal characters even under `scope: all`, because a numeric reference to them is not round-trip safe: HTML parsers read `&#128;`–`&#159;` as their windows-1252 characters (so `&#128;` becomes `€`) and `&#0;` as U+FFFD, so encoding them numerically would produce output that decodes to something else. [HTML entity decode](/util/html_entity_decode/) applies the same remap when reading numeric references, so it agrees with a browser; since this encoder never emits those references, round-tripping through both tools returns the original text.

## Common uses

- Preparing non-ASCII text (names, accented text, symbols) for inclusion in HTML documents or emails that must stay pure ASCII.
- Escaping user input for HTML output when you want explicit control over the reference style, rather than the fixed named set [escape HTML](/util/escape_html/) produces.
- Generating HTML fixtures or test data with a specific, predictable escaping style (decimal or hex) for downstream comparison.
- Producing HTML-safe text for systems that reject raw high-byte characters.

## Tips and pitfalls

- To reverse this encoding, use [HTML entity decode](/util/html_entity_decode/), which resolves named, decimal, and hex references (and even legacy names without a trailing semicolon) back to text.
- `scope: non-ascii` (the default) already produces pure-ASCII output, apart from the U+0000 and U+0080–U+009F exceptions above. `scope: all` also replaces plain ASCII letters and digits, which only makes the text longer — useful for fixtures, not for safety.
- The HTML5 names for `&lang;` and `&rang;` point at U+27E8/U+27E9 (the mathematical angle brackets), not the deprecated HTML4 CJK brackets U+2329/U+232A — this table follows the HTML5 mapping that real browsers use.
- If you need to escape a string for JSON or a source-code literal rather than HTML, use [JSON escape](/util/json_escape/) or [code string escape](/util/code_string_escape/) instead — HTML entities have no meaning in those contexts.
