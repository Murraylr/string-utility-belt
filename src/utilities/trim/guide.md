---
title: Trim Whitespace Online — Strip Leading & Trailing Space
description: Remove leading and trailing whitespace, tabs and newlines from text online, while every space between words stays untouched.
---
## What does trimming whitespace do?

Trimming removes whitespace from the two ends of a string — spaces, tabs, newlines and carriage returns — while leaving every character in between exactly as it was. It is one of the most common cleanup steps in text processing: form input that picked up a stray leading space, a value copy-pasted with a trailing newline, or a multi-line block of text that needs its outer padding removed before further processing.

## How it works

The tool uses JavaScript's built-in `String.prototype.trim()`, which strips any run of whitespace — spaces, tabs (`\t`), newlines (`\n`), carriage returns (`\r`), and the other Unicode whitespace and line-terminator characters such as the non-breaking space and the byte-order mark — from the very start and the very end of the string. Nothing in the middle is touched, no matter how much internal whitespace there is.

```example
title: trim spaces from both ends
input:    padded text   
output: padded text
```

```example
title: internal whitespace is left alone
input:   hello world  
output: hello world
```

Tabs and newlines at the edges are removed just like spaces:

```example
title: trim tabs and newlines
params: {}
input-encoding: hex
input: 09 0a 68 65 6c 6c 6f 0a 09
output: hello
```

If the whole string is nothing but whitespace, trimming leaves nothing behind:

```example
title: an all-whitespace string trims to nothing
params: {}
input-encoding: hex
input: 20 20 20 09 0a 20 20
output: 
```

## Options

This utility has no configurable options — it always trims both ends using standard whitespace rules. If you need to trim only one side, or trim a specific character rather than whitespace, see the tips below for alternatives.

## Common uses

- Cleaning up user input from a form field, a CSV cell, or a config value before validating or storing it.
- Removing a trailing newline that a copy-paste or a file read added to an otherwise single-line value.
- Normalizing text before comparing two strings for equality, so accidental surrounding whitespace does not cause a false mismatch.
- Preparing text for a pipeline step that treats leading or trailing whitespace as significant, such as building a fixed-width value with [pad](/util/pad/).

## Tips and pitfalls

- Trim only removes whitespace from the two ends; if you also need to collapse multiple spaces *inside* the text down to one, use [collapse whitespace](/util/collapse_whitespace/) afterward.
- To trim whitespace from every line of a multi-line block rather than just the very start and end of the whole text, use [trim lines](/util/trim_lines/) instead — plain trim only touches the outermost edges.
- To trim only one side, or to trim other characters such as leading zeros or a trailing comma from the ends, use [trim each line](/util/trim_lines/), which has a side option and a custom character set (it works on every line, which for a single-line value is the same thing), or [find and replace](/util/replace/) with an anchored pattern like `^0+` or `,$`. Avoid [strip characters](/util/strip_chars/) for this: it removes the characters everywhere in the text, not just at the ends.
- If you specifically need a fixed final length rather than just removing existing padding, pair this with [pad](/util/pad/) or [truncate](/util/truncate/).
- To remove blank lines from a multi-line document rather than trimming whitespace from the ends, use [remove blank lines](/util/remove_blank_lines/).
