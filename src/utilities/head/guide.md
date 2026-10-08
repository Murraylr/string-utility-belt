---
title: Head Command Online: Keep the First Lines of Text
description: Keep the first N lines, words or characters of text online, or drop the last N with a negative count, like the Unix head command.
---
## What does the head command do?

`head` keeps the beginning of a text and discards the rest. On the command line, `head -n 10 file` shows the first 10 lines of a file; this tool does the same thing in the browser, and extends the idea to counting words or characters instead of lines.

## How it works

The **count** option sets how much of the input to keep, and **unit** decides what "how much" is measured in.

```example
title: keep the first two lines
params: {"count": 2, "unit": "lines"}
input:
one
two
three
four
five
output:
one
two
```

Setting **unit** to `characters` keeps the first N characters (measured in whole Unicode code points, so a single-code-point emoji is never split into surrogate halves, though a flag or skin-tone sequence made of several code points can still be cut apart), and `words` keeps the first N whitespace-separated words, preserving the original spacing between them:

```example
title: keep the first five characters
params: {"count": 5, "unit": "characters"}
input: hello world
output: hello
```

A **negative** count flips the meaning to "all but the last N". `count: -2` with `unit: lines` drops the last two lines and keeps everything before them, which is a quick way to remove a known-length footer:

```example
title: a negative count drops that many lines off the end
params: {"count": -2}
input:
one
two
three
four
five
output:
one
two
three
```

```example
title: a negative count also works with words
params: {"count": -1, "unit": "words"}
input: the quick brown fox
output: the quick brown
```

A count of `0` returns an empty result, and a count larger than the input simply returns the whole input unchanged. There is no error either way.

## Options

- **count (negative = all but the last N)**: how many lines, words or characters to keep from the start. Defaults to `10`, like `head`. A negative value keeps everything except the last `|count|` units instead, like GNU `head -n -K`.
- **unit**: `lines`, `characters` (Unicode code points), or `words` (whitespace-separated tokens). Defaults to `lines`.

## Common uses

- Previewing the start of a large file or log without loading the whole thing elsewhere.
- Stripping a known-length footer or signature block off the end of a document using a negative line count.
- Truncating a long value down to its first few words for a summary or preview.
- Checking the first few characters of an encoded or hashed value while debugging a pipeline.

## Tips and pitfalls

- Each line's own line ending (LF or CRLF) is preserved, and a file with mixed endings keeps each line's original terminator rather than being normalized to one style. A lone carriage return is not treated as a line break.
- Unlike `head -c`, which counts bytes, the `characters` unit counts code points, so it never cuts a multi-byte character in half.
- The result only ends in a trailing newline if the input itself did. `head` never adds one that was not already there.
- For the mirror operation (keeping the *last* N lines, words or characters), use [tail](/util/tail/).
- To keep lines based on matching a pattern rather than a position, use [grep lines](/util/grep_lines/); to keep lines based on their length, use [filter lines by length](/util/filter_lines_by_length/).
- To shorten a single value to a maximum length with an ellipsis marker, rather than cutting a multi-line document, use [truncate](/util/truncate/) instead.
