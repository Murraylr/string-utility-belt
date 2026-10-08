---
title: Unicode Code Point Inspector: Analyze Characters Online
description: Break text into code points and inspect each one's U+ value, UTF-8/UTF-16 bytes, general category, script, block, and combining or emoji flags.
---
## What does a code point inspector do?

Text that looks simple can hide a lot: an accented letter might be one composed character or a base letter plus a separate combining mark, an emoji might be several code points joined together, and a script mix-up (a Cyrillic "а" standing in for a Latin "a") is invisible to the eye. This tool breaks text apart into individual Unicode code points and reports, for each one, its `U+` value and decimal value, its exact UTF-8 and UTF-16 bytes, its general category and script, which Unicode block it belongs to, and whether it is a combining mark or an emoji.

## How it works

Give it text, and it walks the string one code point at a time (never splitting a surrogate pair in two) and inspects each one.

```example
title: letters, an accent and an emoji
params: {"limit": 5}
input: Aé😀
output:
#  CHAR  CODE POINT  DEC     UTF-8        UTF-16     GC  CATEGORY          SCRIPT  BLOCK               FLAGS
0  A     U+0041      65      41           0041       Lu  Uppercase Letter  Latin   Basic Latin
1  é     U+00E9      233     C3 A9        00E9       Ll  Lowercase Letter  Latin   Latin-1 Supplement
2  😀    U+1F600     128512  F0 9F 98 80  D83D DE00  So  Other Symbol      Common  Emoticons           emoji
```

Note how `😀` needs four UTF-8 bytes and two UTF-16 code units (`D83D DE00`, a surrogate pair) even though it is a single code point and a single row here. This tool always counts and indexes by code point, so an emoji or other astral character is never split across two rows.

### Table or JSON output

The default **table** format lines everything up in columns for quick reading. Switch **format** to `json` for a structured report: the same fields, plus `total` (how many code points the input has) and `shown`/`truncated` for when a limit is applied.

```example
title: json output for a short string
params: {"format": "json"}
input: Hi
output:
{
  "total": 2,
  "shown": 2,
  "truncated": false,
  "codePoints": [
    {
      "index": 0,
      "char": "H",
      "codePoint": "U+0048",
      "decimal": 72,
      "utf8": "48",
      "utf16": "0048",
      "category": "Lu",
      "categoryName": "Uppercase Letter",
      "script": "Latin",
      "block": "Basic Latin",
      "isCombining": false,
      "isEmoji": false
    },
    {
      "index": 1,
      "char": "i",
      "codePoint": "U+0069",
      "decimal": 105,
      "utf8": "69",
      "utf16": "0069",
      "category": "Ll",
      "categoryName": "Lowercase Letter",
      "script": "Latin",
      "block": "Basic Latin",
      "isCombining": false,
      "isEmoji": false
    }
  ]
}
```

### General category and script

`category` is a two-letter Unicode general category code (`Lu` uppercase letter, `Ll` lowercase letter, `Nd` decimal digit, `Sc` currency symbol, `Cc` control, and so on), with `categoryName` spelling it out. `script` names the writing system a character belongs to (`Latin`, `Cyrillic`, `Han`, `Hiragana`...); punctuation, digits and symbols shared across scripts are reported as `Common`.

```example
title: a digit and a currency symbol
params: {"format": "json"}
input: 7€
output:
{
  "total": 2,
  "shown": 2,
  "truncated": false,
  "codePoints": [
    {
      "index": 0,
      "char": "7",
      "codePoint": "U+0037",
      "decimal": 55,
      "utf8": "37",
      "utf16": "0037",
      "category": "Nd",
      "categoryName": "Decimal Number",
      "script": "Common",
      "block": "Basic Latin",
      "isCombining": false,
      "isEmoji": false
    },
    {
      "index": 1,
      "char": "€",
      "codePoint": "U+20AC",
      "decimal": 8364,
      "utf8": "E2 82 AC",
      "utf16": "20AC",
      "category": "Sc",
      "categoryName": "Currency Symbol",
      "script": "Common",
      "block": "Currency Symbols",
      "isCombining": false,
      "isEmoji": false
    }
  ]
}
```

### Long input and the limit

By default only the first 200 code points are inspected, to keep the table readable and fast on long input. Set **limit** to `0` to inspect everything, or to any other number to cap it there.

```example
title: a low limit truncates the table
params: {"limit": 2}
input: abcdef
output:
#  CHAR  CODE POINT  DEC  UTF-8  UTF-16  GC  CATEGORY          SCRIPT  BLOCK        FLAGS
0  a     U+0061      97   61     0061    Ll  Lowercase Letter  Latin   Basic Latin
1  b     U+0062      98   62     0062    Ll  Lowercase Letter  Latin   Basic Latin
… 4 more code points not shown (limit 2)
```

## Options

- **limit**: how many code points to inspect, from the start of the input. Defaults to 200; `0` means no limit (inspect everything). The largest explicit limit is 100,000.
- **format**: `table` (default, aligned columns for reading) or `json` (structured data for further processing).

## Common uses

- Diagnosing "invisible" text bugs: a character that looks right but does not match in comparisons, search, or sorting is often a different code point, a combining sequence, or a stray zero-width character.
- Checking whether a string mixes scripts unexpectedly, which matters for spoofing-resistant validation (a Cyrillic look-alike letter in what should be a plain English name).
- Understanding exactly how many bytes a piece of text will take up once encoded, by reading the `utf8` column directly.
- Teaching or learning how UTF-8 and UTF-16 represent characters, especially the surrogate-pair mechanics behind emoji and other characters outside the Basic Multilingual Plane.

## Tips and pitfalls

- Category and script come from the JavaScript engine's own Unicode data (via regular expression Unicode property escapes), so they reflect the Unicode version your browser or runtime ships. Block names have no such source in JavaScript and come from a built-in range table that does not list every block, so a character from a block missing from it (for example Glagolitic Supplement) is shown with block `Unassigned` even though it is a real, assigned character.
- A combining mark (`isCombining: true`) is shown with a dotted-circle placeholder (`◌`) in table view so it renders visibly instead of attaching to the character before it. That is how you spot an `é` typed as `e` plus U+0301 COMBINING ACUTE ACCENT: it looks identical to precomposed `é` (U+00E9) but shows up here as two rows.
- Lone (unpaired) surrogates (malformed data, not real characters) are still reported rather than causing an error, categorized as `Cs` (Surrogate), so this tool is safe to run on broken or adversarial input.
- If what you actually want is to strip the invisible or zero-width characters this tool surfaces, rather than just see them, use [remove invisible characters](/util/remove_invisible/).
