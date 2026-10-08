---
title: HTML Entity Decoder: Decode Named & Numeric References
description: Decode HTML named entities, legacy names without a semicolon, and &#decimal; / &#xHEX; numeric character references back to text.
---
## What does decoding HTML entities do?

HTML documents represent many characters as *character references* instead of the literal character: named ones like `&eacute;` or `&amp;`, and numeric ones like `&#233;` or `&#xE9;`. This tool is the counterpart to [HTML entity encode](/util/html_entity_encode/): it scans text for any of those forms and resolves each one back to the character it represents, following the rules a browser's HTML parser applies to text content, including quirks like legacy names that work without a trailing semicolon.

## How it works

The decoder makes a single left-to-right pass over the input, looking for `&`. At each one it tries, in order:

1. **A numeric reference**: `&#` followed by decimal digits, or `&#x`/`&#X` followed by hex digits, usually ending in `;` (as in browsers, the `;` is optional here). The digits are read as a Unicode code point and converted to that character.
2. **A named reference terminated by `;`**: if the letters after `&` up to the `;` match a known entity name exactly, it resolves to that character. The table covers the HTML 4.01 named set (Latin-1, Greek, math symbols, arrows, punctuation), `&apos;`, a few uppercase aliases (`&AMP;`, `&COPY;`, …) and a handful of HTML5 additions. That is about 280 names in total.
3. **A legacy name without a semicolon**: a small subset of pre-HTML4 names (anything mapped to a code point below 256, other than `apos`) resolves even without the trailing `;`, as browsers do in text content. The decoder finds the *longest* such name that prefixes the run of letters, so `&notin;`-style ambiguity resolves the way a browser would.

Anything that matches none of these is left untouched, `&` included.

```example
title: named and numeric entities
input: &lt;div&gt;Caf&eacute;&lt;/div&gt;
output: <div>Café</div>
```

### Legacy names without a semicolon

```example
title: legacy names work even without a trailing semicolon
input: &copy 2024
output: © 2024
```

Here `&copy` (with no `;`) still resolves to `©` because `copy` is one of the legacy pre-HTML4 names. It is the same behavior browsers apply when parsing `&copyright` as `©right`.

### Decimal and hex numeric references

```example
title: decimal and hex numeric references
input: &#72;&#105;&#x21;
output: Hi!
```

Numeric references above the Basic Multilingual Plane decode to a single character, not a broken surrogate pair: `&#128512;` and `&#x1F600;` both produce one emoji character.

### The windows-1252 remap for C1 numeric references

```example
title: a numeric reference in the C1 range remaps like a real browser
input: it&#146;s
output: it’s
```

This looks surprising at first: `&#146;` is U+0092, a control character, not the right single quotation mark. But every real HTML parser maps numeric references in the range 0x80–0x9F to their historical windows-1252 equivalents, because that is how they were widely misused in early web content. This decoder reproduces that exact remap so it agrees with a browser byte for byte, rather than "correctly" producing an invisible control character.

## Common uses

- Turning HTML source copied from a browser's view-source, an RSS/Atom feed, or a scraped page into plain, readable text.
- Decoding data that was entity-encoded for storage or transport before further processing (search indexing, diffing, translation).
- Debugging "why does my text show `&amp;`" issues in HTML-derived content.
- Reading old or hand-authored HTML that mixes named entities, numeric references, and legacy unterminated names.

## Tips and pitfalls

- This decoder throws on a reference to a code point that cannot exist as a character (out-of-range values above U+10FFFF, lone surrogate values U+D800–U+DFFF, and the null reference `&#0;`), since none of those are valid decoded output. (A browser would silently substitute U+FFFD instead.)
- HTML5 defines over 2,000 named references; this table has about 280 of the most common ones. Rarer HTML5-only names such as `&NotEqual;` or `&bigstar;` are left in the output as written.
- Unknown or malformed references (`&bogus;`, `&#;`, `&NBSP;`, which HTML5 does not define, unlike `&AMP;`) are left in the output verbatim rather than guessed at.
- Decoding happens in a single pass: `&amp;lt;` decodes only its `&amp;` to `&`, giving `&lt;`, not all the way to `<`. That is the correct behavior for double-escaped text. Run the tool again if you intend to fully unwind it.
- To go the other direction, use [HTML entity encode](/util/html_entity_encode/). For the simpler five-character set instead of the full entity table, use [unescape HTML](/util/unescape_html/) / [escape HTML](/util/escape_html/).
