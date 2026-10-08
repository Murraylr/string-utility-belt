---
title: Number Lines Online: Add Line Numbers to Text
description: Add line numbers to text online, like cat -n or nl. Choose the starting number and separator, with worked examples for common numbering styles.
---
## What does numbering lines do?

This tool prefixes every line of text with its line number, the same basic job as Unix `cat -n` or `nl`, though the numbers are not padded to a fixed width and blank lines are always numbered. It is a quick way to make a block of text referenceable by line. That is useful when sharing a snippet, reviewing generated output, or preparing text for something that expects numbered lines.

## How it works

The input is split into lines on `\n`. Each line is prefixed with a running count, starting from the **start number**, followed by the **separator**, followed by the line's original text:

```example
title: default numbering starting at 1
input: a
b
c
output: 1: a
2: b
3: c
```

The starting number does not have to be 1. A **start** of 10 continues from there for every following line:

```example
title: starting from a custom number
params: {"start": 10}
input: a
b
output: 10: a
11: b
```

The **separator** between the number and the text is also configurable, for example a period and space instead of a colon:

```example
title: a period-and-space separator
params: {"separator": ". "}
input: a
b
output: 1. a
2. b
```

A start of `0` is valid too, numbering the first line `0`:

```example
title: starting the count at zero
params: {"start": 0}
input: a
b
output: 0: a
1: b
```

Empty input is treated as a single empty line, so it still gets a line number:

```example
title: empty input still produces one numbered (empty) line
input:
output: 1: 
```

## Options

- **start number** (`start`, default `1`): the number given to the first line. Later lines increment from it by one each.
- **separator** (`separator`, default `: `): the text placed between the line number and the line's content.

## Common uses

- Referencing specific lines when discussing a snippet of code, config, or log output in a message or ticket.
- Preparing text for tools or formats that expect a leading line number on each row.
- Quickly counting how many lines a block of text has by checking the last number printed (with the default start of 1, and allowing for a trailing newline).

## Tips and pitfalls

- This tool splits only on `\n`. If your text uses Windows-style `\r\n` endings, a trailing `\r` stays attached to the end of each line's content rather than being treated as a separate line break; run [normalize line endings](/util/normalize_line_endings/) first if that matters to you.
- Every line is numbered, blank ones included. There is no option to skip blank lines the way `nl` does by default.
- A trailing newline counts as the start of one more, empty line: `a`, `b` followed by a final newline comes out as `1: a`, `2: b` and a third line `3: `. Remove the final newline first (for example with [normalize line endings](/util/normalize_line_endings/) and `finalNewline: remove`) if you do not want it numbered.
- To sort or deduplicate lines as well as number them, run [sort lines](/util/line_sort/) or [deduplicate lines](/util/line_dedupe/) before this step, since numbering fixes the line order in the output.
