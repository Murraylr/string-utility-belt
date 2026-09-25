---
title: Tail Command Online — Keep the Last Lines of Text
description: Keep the last N lines, words or characters of text online, or drop the first N with a negative count, like the Unix tail command.
---
## What does the tail command do?

`tail` keeps the end of a text and discards the beginning — the mirror image of [head](/util/head/). On the command line, `tail -n 10 file` shows a file's last 10 lines, which is the classic way to check the newest entries at the bottom of a growing log. This tool does the same thing in the browser, and can measure the amount to keep in lines, words, or characters.

## How it works

The **count** option sets how much of the input to keep from the end, and **unit** decides what unit that count is measured in.

```example
title: keep the last two lines
params: {"count": 2, "unit": "lines"}
input:
one
two
three
four
five
output:
four
five
```

With **unit** set to `characters`, the last N characters are kept, measured in whole Unicode code points so a character outside the Basic Multilingual Plane, like most emoji, is never split into surrogate halves (a flag or skin-tone sequence made of several code points can still be cut apart); with `words`, the last N whitespace-separated words are kept, and the original spacing around them is preserved exactly:

```example
title: keep the last two words
params: {"count": 2, "unit": "words"}
input: the quick  brown fox
output: brown fox
```

A **negative** count flips the meaning to "all but the first N" — a negative line count is a fast way to drop a header row and keep everything after it:

```example
title: a negative count drops that many lines from the start
params: {"count": -1}
input:
one
two
three
four
five
output:
two
three
four
five
```

A count of `0` returns an empty result, and a count larger than the input returns the whole input unchanged, whitespace and all.

## Options

- **count (negative = all but the first N)** — how many lines, words or characters to keep, counting from the end. Defaults to `10`, like `tail`. A negative value keeps everything except the first `|count|` units instead.
- **unit** — `lines`, `characters` (Unicode code points), or `words` (whitespace-separated tokens). Defaults to `lines`.

## Common uses

- Checking the most recent entries in a log or a growing text export.
- Dropping a header row from tabular text with a negative line count of `-1`, keeping every row after it.
- Grabbing the last few words of a longer value, such as a trailing status or suffix.
- Inspecting the tail end of an encoded or hashed value while debugging a pipeline.

## Tips and pitfalls

- A negative count does not mean what it does in GNU `tail`, where `-n -2` is the same as `-n 2` and `-n +3` starts at line 3. Here `count: -2` drops the first two lines, which corresponds to `tail -n +3`.
- Each line's own original line ending (LF or CRLF) is preserved; a file with mixed endings is not normalized to a single style.
- The output only ends in a trailing newline if the input itself did.
- For the mirror operation — keeping the *first* N lines, words or characters — use [head](/util/head/).
- To keep lines that match a pattern rather than a position from the end, use [grep lines](/util/grep_lines/); to reverse the order of all the lines instead of trimming them, use [reverse line order](/util/line_reverse/).
- If you want the newest entries first rather than last, pair this with [reverse line order](/util/line_reverse/) to flip the kept lines afterward.
