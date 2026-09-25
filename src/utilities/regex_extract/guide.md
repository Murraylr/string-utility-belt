---
title: Regex Extract Online — Pull All Pattern Matches from Text
description: Extract every regular expression match from text online, one per line, with support for case-insensitive and other JavaScript regex flags.
---
## What does this tool do?

This tool runs a regular expression against your text and returns every match it finds, one per line — the same idea as the command-line `grep -o`. Where a plain find-and-replace changes text, this tool pulls specific pieces *out* of it: every email address, every number, every word matching a pattern.

```example
title: extract every run of digits
params: {"pattern": "\\d+"}
input: abc 123 def 456
output: 123
456
```

## How it works

You provide a **pattern** (a JavaScript regular expression, without the surrounding slashes) and optional **flags**. The tool always searches globally for every match in the text, even if you leave the `g` flag out of the flags field yourself — without it, JavaScript's own matching would stop after the first result, which would contradict "extract all matches."

```example
title: all matches are found even if you forget the g flag
params: {"pattern": "\\d+", "flags": "i"}
input: abc 123 def 456
output: 123
456
```

If the pattern is left empty, the input passes through unchanged; if the pattern is valid but nothing in the text matches it, the result is empty rather than an error.

```example
title: no matches produces empty output
params: {"pattern": "\\d+"}
input: hello
output:
```

## Case sensitivity and other flags

The **flags** field accepts any combination of JavaScript's regular expression flags — most commonly `i` for case-insensitive matching, and `m` for multiline mode (which changes how `^` and `$` behave in text with several lines).

```example
title: the i flag matches regardless of case
params: {"pattern": "hello", "flags": "gi"}
input: Hello WORLD hello
output: Hello
hello
```

## Options

- **pattern** — a JavaScript regular expression body, without the enclosing slashes (for example `\d+`, not `/\d+/`).
- **flags** — regex flags such as `i` (case-insensitive) or `m` (multiline); `g` (global) is always applied even if omitted here. Default `g`.

## Common uses

- Pulling every email address, URL, phone number, or IP address out of a block of text.
- Extracting all numbers, hex codes, or identifiers from a log file or data dump.
- Isolating hashtags, mentions, or other marked tokens from social text.
- Grabbing every occurrence of a specific word or code pattern for a quick count or review.

## Tips and pitfalls

- Only the **whole match** for each occurrence is returned, one per line — capture groups inside the pattern (`(...)`) are not broken out separately, even without the `g` flag. A pattern like `(\d)(\d)` still returns each full two-digit match, not the individual captured digits.
- Because the tool searches globally, a pattern that can match an empty string can behave unexpectedly; keep patterns specific (`\d+` rather than `\d*`) to avoid a flood of empty matches.
- The output joins matches with a newline, so if a match itself contains a newline (with the `s`/dotall flag, for instance), the extracted lines and the match boundaries can become ambiguous — inspect the result carefully in that case.
- To transform matched text instead of just pulling it out, use [multi_replace](/util/multi_replace/) with **find is a regex** turned on, which supports the same JavaScript regex syntax plus `$1`-style replacement references. For a plain-English breakdown of what a pattern does, see [regex_explain](/util/regex_explain/).
