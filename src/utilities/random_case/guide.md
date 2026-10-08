---
title: Random Case Generator: Randomize Text Capitalization
description: Randomly capitalize letters online at any probability, from a light sprinkle of caps to full chaos. Use a seed for reproducible, shareable output.
---
## What is random case?

Random case flips each letter to upper or lower case independently, based on a chance you set, instead of following a fixed pattern like alternating case. The result ranges from a light dusting of stray capitals to something as jumbled as [alternating case](/util/alternating_case/)'s SpongeBob-meme look, depending on the probability you choose.

## How it works

For every letter in the input, the tool draws a random number and compares it against the **uppercase probability**: if the draw is below the threshold, the letter is uppercased; otherwise it is lowercased. Non-letters (spaces, digits, punctuation, emoji) are always left exactly as they are and never consume a random draw.

```example
title: seeded, roughly half the letters end up uppercase
params: {"seed": 1, "probability": 0.5}
input: hello world
output: hEllo WorLd
```

At the extremes, the probability behaves predictably: `1` uppercases every letter, and `0` lowercases every letter, since the random draw can never land the other way:

```example
title: probability 1 always uppercases
params: {"probability": 1}
input: Hello World
output: HELLO WORLD
```

```example
title: probability 0 always lowercases
params: {"probability": 0}
input: Hello World
output: hello world
```

### Reproducible output with a seed

Leaving **seed** at `0` (the default) seeds the generator from the platform's cryptographic random source on every run, so the result will almost always differ, even for identical input and probability. Setting a non-zero seed switches to a deterministic pseudo-random sequence, so the same input, probability, and seed always produce the exact same output. That is useful for sharing a specific "random" result or writing a repeatable example:

```example
title: a non-zero seed is fully reproducible
params: {"seed": 12345, "probability": 0.5}
input: the quick brown fox
output: tHE quICk brOwn foX
```

Empty input never throws, whatever the parameters, and simply returns empty output:

```example
title: empty input
input:
output:
```

## Options

- **uppercase probability** (`probability`, default `0.5`, range 0–1): the chance, per letter, that it becomes uppercase. `0.5` is an even coin flip; values closer to `0` or `1` skew the result toward mostly-lowercase or mostly-uppercase.
- **seed** (`seed`, default `0`): `0` means unpredictable, freshly randomized output on every run. Any other whole number reproduces the exact same letter-by-letter result for the same input and probability (a fractional seed is truncated first, so `1.7` behaves like `1`).

## Common uses

- Generating "mocking" or sarcastic-sounding text at a lighter touch than full alternating case.
- Producing varied, chaotic-looking sample text for design mockups or testing how a UI handles mixed-case input.
- Creating a reproducible "random" transformation for a demo, test fixture, or shareable link, by fixing the seed.

## Tips and pitfalls

- Because the choice is made independently per letter, the same letter can appear both upper and lower case in different places in the same output. This is not alternating case, and runs of the same case do happen by chance.
- A cleared or blank probability field falls back to the default of `0.5` rather than being treated as `0`.
- For a strict letter-by-letter alternation instead of randomness, use [alternating case](/util/alternating_case/); to invert every letter's existing case exactly once, use [swap case](/util/swap_case/).
- The random draw only ever touches letters (as recognized by Unicode, not just ASCII), so accented letters and cased scripts such as Greek and Cyrillic are randomized too, while numbers and symbols are always left alone. Letters from caseless scripts such as Chinese still consume a draw but come out unchanged.
