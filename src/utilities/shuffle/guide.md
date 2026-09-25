---
title: Shuffle Text Online — Randomize Lines or Words
description: Randomly shuffle the lines, words or characters of your text online with a Fisher-Yates shuffle, and an optional seed for a repeatable order.
---
## What does shuffling text do?

Shuffling reorders parts of your text at random — whole lines, individual words, or individual characters — using the [Fisher-Yates shuffle](https://en.wikipedia.org/wiki/Fisher%E2%80%93Yates_shuffle), the standard algorithm for producing an unbiased random permutation, where every possible ordering is equally likely given a perfect random source. This tool drives it with mulberry32, a small, fast 32-bit pseudo-random generator, seeded from a single `crypto.getRandomValues` draw when the seed is `0`. That means it can produce at most about 4.3 billion (2^32) different orderings of a given input — plenty for everyday use, but for 13 or more items it is only a fraction of all possible orderings, and it is not suitable for anything security- or money-sensitive such as drawing winners or dealing cards for stakes. This is different from sorting or reversing, which both produce one specific, predictable order; shuffling deliberately destroys the original order.

## How it works

In `words` mode, whitespace stays exactly where it is and only the non-whitespace tokens move, so line breaks and spacing are preserved:

```example
title: shuffling words (seeded for a reproducible example)
input: the quick brown fox
params: {"unit": "words", "seed": 42}
output: the fox quick brown
```

In `lines` mode, whole lines swap places with each other:

```example
title: shuffling lines
input: one
two
three
four
params: {"unit": "lines", "seed": 42}
output: one
four
two
three
```

In `characters` mode, individual characters are shuffled among themselves, but whitespace characters stay pinned in their original positions — so a shuffled sentence still has its words visually separated rather than running together:

```example
title: shuffling characters, with whitespace pinned in place
input: abcdef ghijkl
params: {"unit": "characters", "seed": 2024}
output: idfbac kelghj
```

Empty input returns an empty string in every mode:

```example
title: empty input
input:
output:
```

## Options

- **unit** — `lines` (default), `words`, or `characters`.
- **seed (0 = random)** — `0` (the default) picks a fresh random seed, so each run gives a different order. Any other integer reproduces the exact same shuffle of the same input every time, which is what makes the examples on this page reproducible and is useful when you need to compare two shuffles of the same input.

## Common uses

- Randomizing the order of quiz questions, flashcards, or a playlist stored as lines of text.
- Scrambling a word list for a word-jumble puzzle, or scrambling letters within words for a similar effect while keeping word boundaries intact.
- Producing a randomized test ordering that can be reproduced later by reusing the same seed.

## Tips and pitfalls

- A trailing newline at the end of the input is preserved at the end of the output rather than being shuffled in as if it were an extra blank line — so shuffling `"a\nb\nc\n"` keeps the file ending in a newline.
- `characters` mode operates on Unicode code points, so precomposed accented letters and single emoji move as one unit and are never split into broken surrogate halves. A character built from several code points — a letter plus a combining accent, a flag, a skin-tone or other joined emoji — is split into its parts and scattered.
- Because any ordering, including the original one, can come up, a shuffle of just two or three items often returns the order it started with (a 1 in 2 or 1 in 6 chance) — that is expected, not a bug.
- To reorder text by a rule instead of at random, see [line sort](/util/line_sort/) or [reverse](/util/reverse/); to generate fresh random content rather than reorder existing text, see [random string](/util/random_string/) or [password generator](/util/password_generator/).
