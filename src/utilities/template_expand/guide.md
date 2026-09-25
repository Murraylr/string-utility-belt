---
title: Template Expander — Generate Rows from a Pattern
description: Repeat a text template many times online, substituting row numbers, UUIDs, random numbers, words and input lines into a mail-merge style pattern.
---
## What does template expand do?

Template expand repeats a short text pattern a chosen number of times, substituting `{token}` placeholders with a different value on every row — a row index, a random number, a generated word, a fresh UUID, or a line pulled from your input. It is the same idea as a mail-merge: write the pattern once, and get back one line per row with the tokens filled in differently each time.

## How it works

The simplest token is `{i}`, the 1-based row number:

```example
title: numbered rows
input:
params: {"template": "row-{i}", "count": 3}
output: row-1
row-2
row-3
```

`{i0}` is always zero-based (even when `start` shifts `{i}`), and `{n}` is the total row count, so all three can appear together:

```example
title: {i}, {i0} and {n} together
input:
params: {"template": "{i}/{i0}/{n}", "count": 3}
output: 1/0/3
2/1/3
3/2/3
```

Random tokens draw from the same seeded random source, so a non-zero seed makes every random token in a template reproducible, however many it uses (`{date}` is not random — it is always the real current time):

```example
title: seeded random integers
input:
params: {"template": "{i}: {randint:1,100}", "count": 3, "seed": 42}
output: 1: 61
2: 45
3: 86
```

`{line}` substitutes a line from the input, cycling back to the first line once it runs out — astral characters such as emoji stay whole:

```example
title: {line} pulls from the input, cycling once it runs out
input: alpha
bêta
🎈
params: {"template": "{i}. {line}", "count": 5, "separator": " / "}
output: 1. alpha / 2. bêta / 3. 🎈 / 4. alpha / 5. bêta
```

A token that names an unrecognized field, or that supplies a `:argument` to a token that does not take one, is left untouched in the output rather than causing an error. (A bad argument to a token that needs one, such as `{randint:a,b}` with non-numbers or `{hex:0}`, does throw an error.)

```example
title: unknown tokens, and arguments on tokens that take none, are left as-is
input:
params: {"template": "{nope} {i} {word:2}", "count": 1, "seed": 1}
output: {nope} 1 {word:2}
```

## Options

- **template** — the pattern to repeat, with `{token}` placeholders. Default `{i}, {uuid}`.
- **count** — how many rows to generate; default `10`, from 0 to 100,000. `0` returns an empty string.
- **start index** — the number `{i}` starts counting from; default `1`. `{i0}` is unaffected and always starts at `0`.
- **separator** — what joins the rows; default `\n` (typed as the literal two characters, since a plain text field cannot hold an actual newline; `\t` and `\r` work the same way).
- **seed (0 = random)** — `0` (the default) draws fresh randomness from the browser's cryptographic random number generator for every random-flavored token on every run. Any other integer switches to a small non-cryptographic PRNG and reproduces the exact same output every time, including every `{uuid}`, `{random}`, `{randint:a,b}`, `{word}`, and `{hex:len}` value.

## Every token

| token | expands to |
| --- | --- |
| `{i}` | the row number, starting from `start` |
| `{i0}` | the zero-based row number, always starting from `0` |
| `{n}` | the total row count |
| `{uuid}` | a random v4 UUID |
| `{random}` | a random number between 0 and 1, to six decimal places |
| `{randint:a,b}` | a random whole number between `a` and `b` inclusive (either order) |
| `{word}` | a random word from a short built-in word list |
| `{hex:len}` | `len` random hex characters (1 to 4096) |
| `{date}` | the current time as an ISO 8601 timestamp — computed once, so every row in one run shares the same value |
| `{line}` | the input's line at the current row index, cycling back to the start once the input runs out |

## Common uses

- Generating a batch of numbered test rows, filenames, or identifiers for a script or spreadsheet.
- Producing SQL `INSERT` statements or CSV rows from a single template line, one per record.
- Merging a list of names or values (via `{line}`) into a repeated message pattern.

## Tips and pitfalls

- `{date}` is evaluated once per call, not once per row — every row in a single run shares the exact same timestamp; use `{i}` or a random token if you need each row to be distinct.
- Token names are matched case-insensitively (`{UUID}` works like `{uuid}`), and spaces around a `:argument` are trimmed.
- `{line}` counts every line of the input, including a blank last line left by a trailing newline, so that blank line joins the cycle.
- For a numeric sequence with formatting controls (radix, zero-padding, prefix/suffix) rather than a text template, see [number sequence](/util/number_sequence/); for structured fake records instead of a freeform pattern, see [fake data](/util/fake_data/).
- To generate the UUIDs or random bytes this tool's tokens produce as standalone values instead, see [uuid](/util/uuid/) or [random bytes](/util/random_bytes/).
