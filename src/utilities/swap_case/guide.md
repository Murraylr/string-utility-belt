---
title: Swap Case Online: Invert Uppercase and Lowercase Letters
description: Invert the case of every letter online: uppercase becomes lowercase and lowercase becomes uppercase. Everything else stays untouched. Worked examples included.
---
## What does swapping case mean?

Swap case inverts the capitalization of every letter in the text: each uppercase letter becomes lowercase, and each lowercase letter becomes uppercase. Digits, punctuation, spaces, and emoji are left exactly as they are. It is a simple, mechanical operation. Unlike [change case](/util/case/)'s title or sentence modes, it does not reason about words or sentences at all.

## How it works

The tool walks the text one character at a time. For each letter, it checks whether lowercasing it changes anything: if so, that is the swapped result; otherwise it uppercases it instead. Anything that has no case distinction passes straight through unchanged.

```example
title: default swap
input: Hello World
output: hELLO wORLD
```

Because each letter's swap depends only on itself, running the same input through this tool twice restores the original text for ordinary letters. It is its own inverse. Mixed-case text simply flips letter by letter:

```example
title: mixed-case text swaps letter by letter
input: The Quick Brown Fox.
output: tHE qUICK bROWN fOX.
```

### Letters that change length when swapped

A few characters do not have a one-to-one uppercase form. The German lowercase `ß` ("sharp s") has no single uppercase letter; its uppercase form is the two-letter sequence `SS`, and that is exactly what this tool produces, matching standard Unicode case mapping:

```example
title: ß has no single-character uppercase form
input: straße
output: STRASSE
```

Digits, punctuation, and emoji have no case at all and are never touched, even in the middle of a run of letters:

```example
title: digits, punctuation, and emoji are left alone
input: a1!👍B
output: A1!👍b
```

Empty input returns empty output:

```example
title: empty input
input:
output:
```

## Options

This utility has no configurable options. It always swaps every letter's case.

## Common uses

- Correcting text typed with Caps Lock accidentally left on, where the letters typed with Shift came out lowercase: `hELLO wORLD` swaps back to `Hello World`. If everything came out uppercase, [change case](/util/case/) is the better fix.
- A quick, reversible-for-plain-ASCII visual transform for testing or demos.
- Inspecting how Unicode case mapping treats non-Latin scripts and special characters like `ß`.

## Tips and pitfalls

- Because `ß` expands to `SS` when uppercased, swap case is not always length-preserving: a string comes back one character longer for every `ß` it contains.
- Swapping twice is not guaranteed to reproduce the original for every character: a character whose swapped form itself swaps to something else (such as the two-letter `SS` produced from `ß`, which swaps again to `ss`) will not round-trip back to `ß`.
- For a full alternating pattern instead of a straight inversion, see [alternating case](/util/alternating_case/); for independently randomized case per letter, see [random case](/util/random_case/).
- To apply a single fixed rule like all-uppercase or Title Case instead of inverting existing casing, use [change case](/util/case/).
