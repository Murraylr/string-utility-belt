---
title: Extract Text Before or After a Delimiter Online
description: Pull the text before, after, or between delimiters online, matching the first or last occurrence, over a string or per line.
---
## What does "substring before / after" do?

This tool cuts out the part of a string on one side of a delimiter — or between two delimiters — without writing a regular expression. Give it a marker like `@` or `:` and it hands back everything before it, everything after it, or (with two markers) everything between them. It is the everyday alternative to reaching for a regex when the pattern you actually want is "the part after the first colon" or "whatever is inside the quotes."

## How it works

The **mode** option picks the shape of the cut: **before** keeps everything up to the delimiter, **after** keeps everything past it, and **between** keeps everything between a start and an end delimiter.

```example
title: keep everything before the delimiter (default mode)
params: {"delimiter": "@", "mode": "before", "endDelimiter": "", "occurrence": "first", "perLine": false, "ifMissing": "whole"}
input: user@example.com
output: user
```

```example
title: keep everything after the delimiter
params: {"delimiter": "@", "mode": "after", "endDelimiter": "", "occurrence": "first", "perLine": false, "ifMissing": "whole"}
input: user@example.com
output: example.com
```

In **between** mode, the **end delimiter** marks where the cut stops. If you leave **end delimiter** blank, the same delimiter is reused on both sides, which is exactly what you want for pulling text out of a pair of matching quotes (brackets and tags have different opening and closing markers, so give those an **end delimiter**):

```example
title: reuse one delimiter to pull text out of quotes
params: {"delimiter": "\"", "mode": "between"}
input: say "hi" now
output: hi
```

```example
title: between mode with two different delimiters
params: {"delimiter": "<b>", "mode": "between", "endDelimiter": "</b>"}
input: <b>bold</b>
output: bold
```

**Occurrence** decides whether the *first* or the *last* match of the delimiter is used, which matters as soon as a delimiter appears more than once:

```example
title: the last occurrence, not the first
params: {"delimiter": ".", "mode": "after", "occurrence": "last"}
input: a.b.c
output: c
```

When the delimiter is not found at all, **if not found** decides what happens: return the whole input unchanged (`whole`, the default), return an empty string (`empty`), or throw an error (`error`) — useful when a missing delimiter should stop a pipeline rather than pass bad data through silently.

```example
title: a missing delimiter returns nothing when set to "empty"
params: {"delimiter": "@", "ifMissing": "empty"}
input: hello
output: 
```

## Options

- **delimiter** — the marker to cut on, matched literally (not as a regex). Supports the `\n`, `\r`, `\t` and `\\` escapes for characters that are awkward to type, as does **end delimiter**. Required: an empty delimiter is an error.
- **mode** — `before`, `after`, or `between`. Defaults to `before`.
- **end delimiter** — the closing marker in `between` mode. Leaving it blank reuses **delimiter** as the end marker too. Ignored outside `between` mode.
- **occurrence** — `first` or `last`. In `between` mode, `last` pairs the delimiter and end delimiter nearest the end of the text, rather than the first pair found from the start.
- **per line** — when on, the cut is applied independently to each line instead of to the whole input as one block. Default off.
- **if not found** — `whole` (return the input as-is), `empty` (return nothing), or `error` (throw, naming the line number when **per line** is on).

## Common uses

- Pulling a domain out of an email address, or a value out of a `key=value` pair.
- Extracting the contents of a quoted string, an HTML tag, or a bracketed reference.
- Grabbing a file extension (everything after the last `.`) or a base filename (everything before the first `.`). With the default **if not found** of `whole`, a name with no `.` comes back unchanged, so choose `empty` if that should yield no extension.
- Cleaning up log lines by keeping only the message after a fixed prefix, one line at a time with **per line** on.

## Tips and pitfalls

- "last occurrence" in `between` mode pairs delimiters working backward from the end, so with a repeated delimiter it finds the *last* complete pair, not the first-to-last span across the whole string.
- Two delimiters right next to each other (an empty match, like `""`) return an empty string rather than an error — worth checking for if your data might have empty quoted fields.
- If you need pattern matching rather than a literal delimiter — for example, "the part after the first digit" — use [find and replace](/util/replace/) with a regular expression that deletes the unwanted part (such as `^\D*\d` replaced with nothing), or a capture group in [sed script](/util/sed/).
- To cut by a fixed character position instead of a delimiter, use [string slice](/util/slice/).
- To split into many pieces on a delimiter rather than extracting one span, use [split & join](/util/split_join/).
