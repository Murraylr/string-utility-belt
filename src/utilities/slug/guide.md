---
title: Slug Generator Online: Convert Text to a URL Slug
description: Convert any text to a URL-friendly slug online. Strips accents, lowercases, and joins words with hyphens for permalinks, filenames, and IDs.
---
## What is a slug?

A slug is the short, URL-safe version of a title or phrase you see in a web address, such as `/blog/hello-world` instead of `/blog/Hello, World!`. It uses only lowercase ASCII letters, digits, and hyphens, so it is safe to put directly in a URL, filename, or HTML `id` attribute without escaping. This tool converts any text, including accented and Unicode characters, into that form.

## How it works

1. The text is decomposed so that accented letters split into a plain base letter plus a separate accent mark (Unicode NFD normalization), and the accent marks are then dropped, leaving the plain ASCII letter behind: `é` becomes `e`, `ü` becomes `u`, and so on.
2. Every run of one or more characters that is not a plain ASCII letter or digit (spaces, punctuation, symbols, and any Unicode characters with no ASCII equivalent) is replaced with a single hyphen.
3. Leading and trailing hyphens are stripped, so the slug never starts or ends with one.
4. The result is lowercased.

```example
title: accents are stripped, spaces become hyphens
input: Héllo, World!  Ünïcode
output: hello-world-unicode
```

Runs of punctuation collapse to a single hyphen, not one hyphen per character:

```example
title: repeated punctuation collapses to one hyphen
input: a!!!b!!!c
output: a-b-c
```

Numbers are treated the same as letters and pass straight through:

```example
title: numbers are preserved
input: abc 123 def
output: abc-123-def
```

Letters that Unicode does not decompose into a base letter plus an accent, such as `ß`, `Ł`, `ø` and `æ`, are not transliterated. They count as non-ASCII characters and turn into hyphens like any other symbol:

```example
title: letters without a decomposition become hyphens
input: Straße Łódź
output: stra-e-odz
```

Text that is entirely punctuation or symbols, with nothing left to slugify, produces an empty result rather than a stray hyphen:

```example
title: input with no letters or digits produces an empty string
input: !@#$%
output:
```

Empty input stays empty:

```example
title: empty input
input:
output:
```

## Options

This utility has no configurable options. It always applies the same accent-stripping, hyphenation, and lowercasing rule.

## Common uses

- Building a blog post or page URL from its title.
- Generating a stable, human-readable ID or anchor from a heading.
- Producing a safe filename from a user-supplied title or label.
- Normalizing tags or categories to a consistent, comparable form.

## Tips and pitfalls

- Only characters with a decomposable ASCII base survive accent-stripping, and only accents in Unicode's basic combining-diacritics block (U+0300–U+036F) are removed. Text in a script with no Latin equivalent, such as Cyrillic or CJK, is treated as punctuation: it becomes a hyphen between ASCII neighbours (`abcПриветdef` → `abc-def`) and vanishes at the edges, which can leave a short or empty slug for entirely non-Latin input.
- Because everything that is not an ASCII letter or digit becomes a hyphen, apostrophes and underscores split words too: `don't stop` becomes `don-t-stop` and `snake_case` becomes `snake-case`. Text that already is a slug passes through unchanged.
- If you need to keep the original script and only make text URL-safe by percent-encoding it instead of transliterating it, use [URL encode](/util/url_encode/) rather than this tool.
- For other case transforms that keep more of the original text, see [change case](/util/case/) or [format case](/util/format_case/), which convert to `camelCase` or `snake_case` without discarding non-ASCII letters.
