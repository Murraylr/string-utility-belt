---
title: String Slice Online: Extract Text by Index Range
description: Slice a substring from text by start and end character index online, including negative indices counted from the end.
---
## What is a string slice?

Slicing extracts a piece of text between two character positions: a **start** index and an **end** index, where the end position is not included in the result. It is built on JavaScript's `String.prototype.slice` and behaves like it (and much like Python's `s[start:end]`): every character from `start` up to (but not including) `end` is kept. There is one exception, described below: an `end` of `0` means "to the end". It is the most direct way to pull out a fixed-position substring when you know exactly which characters you want by their index rather than by matching a delimiter.

## How it works

Positions are counted from `0` for the first character. Given `start` and `end`, the tool returns everything from `start` up to `end`:

```example
title: extract by start and end index
params: {"start": 6, "end": 11}
input: Hello World
output: World
```

Leaving **end** at its default of `0` (or blank) means "to the end of the string", not "zero characters". This is the one behavior worth remembering: `end: 0` is not the same as an empty result, it is treated as no upper bound at all.

```example
title: end of 0 means "to the end", not "nothing"
params: {"start": 2, "end": 0}
input: abcdef
output: cdef
```

Both **start** and **end** accept negative numbers, which count backward from the end of the string: `-1` is the last character, `-2` the second-to-last, and so on. This matches how negative indices work in JavaScript's `slice` and Python's slicing (though Python counts code points, while this tool counts UTF-16 code units; see the tips below).

```example
title: a negative start counts from the end
params: {"start": -3, "end": 0}
input: abcdef
output: def
```

```example
title: a negative end excludes characters from the end
params: {"start": 0, "end": -1}
input: abcdef
output: abcde
```

If **start** falls beyond the length of the string, or if the effective start position is at or after the effective end position, the result is an empty string rather than an error.

```example
title: a start beyond the string's length yields nothing
params: {"start": 10, "end": 0}
input: abc
output: 
```

## Options

- **start**: the index (0-based) of the first character to keep. A negative value counts from the end of the string.
- **end (optional)**: the index (exclusive) to stop before. Leaving it at `0` (its default) or blank slices all the way to the end of the string. A negative value counts from the end.

## Common uses

- Pulling a fixed-width field out of a record when you know its exact column position, such as the first 8 characters of a serial number.
- Trimming a known number of characters off the front or back of a value, for example dropping a 3-character prefix with `start: 3`.
- Extracting a slice for a preview or a diff, when the boundary is a position rather than a delimiter.
- Quickly checking what a particular index range of a string looks like while debugging string-processing code elsewhere.

## Tips and pitfalls

- Because `end: 0` means "no upper bound", if you actually want an empty result, set `start` and `end` to the same non-zero value instead (or set `start` beyond the string's length). In plain JavaScript, `"abcdef".slice(2, 0)` is empty; here it returns `cdef`.
- Length here is counted in UTF-16 code units, the same units JavaScript itself uses, so an emoji or a rare CJK character built from a surrogate pair counts as 2 rather than 1, so a slice boundary that lands in the middle of one will split it.
- If you want to cut text to a maximum length and add "…" when it doesn't fit, use [truncate](/util/truncate/) instead. Slicing has no concept of an ellipsis.
- To cut based on a delimiter (everything before "@", between quotes, and so on) rather than a fixed index, use [substring before / after](/util/substring_around/).
- To keep the first or last N lines, words or characters rather than an arbitrary index range, see [head](/util/head/) and [tail](/util/tail/), which count characters by code point and so never split an emoji into surrogate halves.
