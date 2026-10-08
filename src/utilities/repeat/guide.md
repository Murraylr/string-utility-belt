---
title: Repeat String Online: Duplicate Text N Times
description: Repeat any text a chosen number of times online, optionally joined by a separator, for test data, patterns, and quick duplication.
---
## What does this tool do?

This tool repeats the input text a fixed number of times, optionally joining each copy with a separator. It is a small building block, but a handy one: generating repeated test data, building a visual separator line, or duplicating a short pattern into a longer one.

```example
title: repeat text with a separator between copies
params: {"count": 3, "separator": "-"}
input: ab
output: ab-ab-ab
```

## How it works

The tool makes **count** copies of the whole input and joins them with **separator**, which is empty by default so the copies run together with nothing between them.

```example
title: with no separator, the copies run together
params: {"count": 3, "separator": ""}
input: ab
output: ababab
```

A count of `0` produces an empty result, and a count of `1` returns the input unchanged:

```example
title: a count of zero produces an empty result
params: {"count": 0}
input: hello
output:
```

Each copy is the whole input treated as one unit, so multi-character text and Unicode characters such as emoji repeat correctly without being split apart:

```example
title: each copy is a whole unit, so emoji repeat cleanly
params: {"count": 2, "separator": " "}
input: 😀
output: 😀 😀
```

## Options

- **count**: how many copies to produce, from 0 to 10,000 (default 2). The lower and upper bounds are enforced by the pipeline's own parameter validation, which keeps a single step from generating an unbounded amount of output and rejects a negative count before it ever reaches the utility.
- **separator**: inserted between each copy, never before the first or after the last (default empty).

## Common uses

- Building a horizontal rule or visual divider (`params: {"count": 40, "separator": ""}` on a single `-` character produces a 40-character line).
- Generating quick test or placeholder data of a known repeated shape.
- Duplicating a short delimiter or pattern into a longer one for a template or fixture.
- Repeating a word or phrase for stress-testing another step further down a pipeline.

## Tips and pitfalls

- The **count** option is capped at 10,000 specifically because repetition multiplies the size of the output. An uncapped repeat count on even a modest input could produce output far larger than intended. If you need more copies than that, chain two repeat steps together (every step's output is still capped at 64 MiB).
- The separator is inserted strictly between copies, so the total output length is `count` copies of the input plus `count - 1` copies of the separator. There is no separator before the first copy or trailing after the last one.
- Repeating text is measured in whole copies of the string, not individual characters, so multi-character and Unicode input (including emoji) repeats correctly as a unit rather than being split apart.
- The separator is used exactly as typed: backslash escapes such as `\n` are not translated, so the web app's single-line separator field cannot put each copy on its own line. End the input itself with a line break instead (the output then ends with one too).
- Repetition cannot vary the copies. To add a running number to copies that sit on separate lines, follow this step with [number_lines](/util/number_lines/).
