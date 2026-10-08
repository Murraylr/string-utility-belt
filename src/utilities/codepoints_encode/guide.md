---
title: Unicode Code Point Converter: Text to U+XXXX
description: List every Unicode code point in text as U+XXXX, plain hex, decimal, or \u{...} escapes, with a custom separator.
---
## What is a code point, and why list them?

Every Unicode character has a number, its code point, conventionally written `U+` followed by hex digits, like `U+0048` for the letter `H` or `U+1F600` for 😀. Listing a string's code points is useful whenever you need to see exactly what characters are really there: distinguishing visually identical characters, checking whether a "weird space" is a regular space or a non-breaking one, or confirming which exact emoji or combining accent a piece of text contains. This tool converts any text into a list of its code points, one entry per code point, in the format you choose.

## How it works

The tool walks the input one Unicode code point at a time, not one UTF-16 code unit at a time, so an emoji or other character outside the Basic Multilingual Plane is listed once, as a single code point, rather than being split into two broken surrogate halves.

```example
title: U+ format
input: Hi!
output: U+0048 U+0069 U+0021
```

```example
title: decimal, astral character
params: {"format": "decimal", "separator": ","}
input: A😀
output: 65,128512
```

😀 is a single entry (`128512`), even though it takes two UTF-16 units to store in a JavaScript string. That is the exact behavior that distinguishes this tool from a naive character-by-character loop.

### Other formats

```example
title: plain hex, no U+ prefix
params: {"format": "hex"}
input: A😀
output: 0041 1F600
```

```example
title: escaped, as a \u{...} literal you could paste into code
params: {"format": "escaped"}
input: A😀
output: \u{0041} \u{1F600}
```

### Custom separators

The **separator** field accepts `\n` and `\t` as literal two-character escapes, which are converted to an actual newline or tab, so you can put each code point on its own line:

```example
title: the separator field understands \n and \t
params: {"separator": "\\n"}
input: Hi
output:
U+0048
U+0069
```

An empty separator packs the code points together with nothing between them.

## Options

- **format**: `u-plus` (default, `U+XXXX`), `hex` (bare hex digits), `decimal`, or `escaped` (`\u{...}`, ready to paste into a JavaScript or PHP string literal). An unrecognized format value falls back to `u-plus`.
- **separator**: the text placed between entries. Default is a single space. `\n`, `\t`, `\r`, `\0` and `\\` are recognized as escapes if you type them literally; any other text (a comma, an arrow, an em dash) is used as-is.

## Common uses

- Diagnosing "invisible" text problems: zero-width characters, mismatched Unicode normalization forms, or characters that look alike but aren't (`0` vs `О`).
- Documenting or teaching the exact code points behind a piece of text, an emoji sequence, or a font-testing string.
- Generating a `\u{...}`-escaped literal for a specific character to paste into source code.
- Comparing two visually similar strings character by character at the code point level to spot the difference.

## Tips and pitfalls

- To reverse this, use [from code points](/util/codepoints_decode/). It reads `U+XXXX` and `\u{...}` output with any punctuation or whitespace separator, or none. Bare `hex` output needs its **radix of bare numbers** option set to `hex` (a token like `0041` has no `a`–`f` digit and would otherwise be read as decimal), and `hex` or `decimal` lists need a separator that isn't a letter or digit.
- If you want an inline escaped string rather than a formatted list (for embedding non-ASCII text in HTML, CSS, or code), [unicode escape](/util/unicode_escape_encode/) produces `\uXXXX`, CSS, or HTML-entity escapes directly in the text instead of a separate list.
- An empty input produces an empty output; there's nothing to list.
- Emoji built from multiple code points (a flag, or a skin-tone modifier joined to a base emoji) list each of their code points separately. This tool lists code points, not user-perceived "grapheme clusters."
