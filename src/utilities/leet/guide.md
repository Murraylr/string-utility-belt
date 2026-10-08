---
title: Leet Speak Translator: Convert Text to 1337 Online
description: Convert text to leet speak (1337) online at a basic, medium, or extreme level, or decode leet speak back to plain letters, with worked examples.
---
## What is leet speak?

Leet speak (also written "l33t" or "1337") replaces ordinary letters with numbers, symbols, or short runs of characters that resemble them. So `e` becomes `3`, `a` becomes `4`, and so on. It originated in early online hacker and gaming culture as an in-group style and a way to dodge simple text filters, and today survives mostly as a joke or a nostalgia font. This tool both encodes plain text into leet and decodes leet back into letters.

## How it works

Each of the three levels defines a substitution table mapping lowercase letters to their leet replacement. Encoding looks up every letter of the input (case-insensitively) and swaps in its replacement; anything not in the table, including spaces, digits, and punctuation, passes through unchanged.

```example
title: basic level, encoding
params: {"level": "basic", "direction": "to-leet"}
input: leet speak
output: l337 5p34k
```

Decoding runs the same table in reverse, trying the longest token first at each position, so a multi-character replacement at the `extreme` level (such as `d` → `|)`) decodes back to a single letter:

```example
title: basic level, decoding leet back to letters
params: {"level": "basic", "direction": "from-leet"}
input: l33t sp34k
output: leet speak
```

The `medium` level substitutes more letters, including some that need punctuation-like symbols:

```example
title: medium level substitutes more letters
params: {"level": "medium"}
input: big cat
output: 819 <47
```

`extreme` goes furthest, using multi-character sequences for several letters. For example, `w` becomes `\^/` and `x` becomes `><`:

```example
title: extreme level uses multi-character substitutions
params: {"level": "extreme"}
input: wax
output: \^/4><
```

When encoding, only the ASCII letters `a`–`z` (in either case) are substituted. Non-Latin text, accented letters, and emoji pass through untouched even when they sit right next to letters that do get converted:

```example
title: non-ASCII characters are left alone
params: {"level": "basic"}
input: café test
output: c4fé 7357
```

Empty input in either direction returns nothing:

```example
title: empty input
params: {"direction": "from-leet"}
input:
output:
```

## Options

- **level** (`level`, default `basic`): `basic` substitutes a handful of the most recognizable letters (`a e i o s t`); `medium` adds more (`b c g h l n z`); `extreme` substitutes all 26 letters, several as multi-character sequences, and swaps some of the simpler mappings too (`i` → `!`, `s` → `$`, `r` → `2`, `z` → `%`).
- **direction** (`direction`, default `to-leet`): `to-leet` encodes plain text; `from-leet` decodes leet speak back into ordinary letters.

## Common uses

- Stylizing gamer tags, usernames, or forum posts in a retro hacker aesthetic.
- Decoding leet-speak text someone else wrote, when you just want to read the plain words.
- Casual obfuscation of a word in text where you want it recognizable but not literally spelled out.

## Tips and pitfalls

- Leet speak is not any kind of security measure. It is trivially readable and just as trivially decoded, including by this same tool.
- Decoding is level-specific: text written with the `extreme` substitution table should be decoded with `level: extreme`. A lower level's table leaves the multi-character tokens as-is, and some symbols mean different letters per level: `2` decodes to `z` at `medium` but to `r` at `extreme`.
- Decoding replaces every token it finds, including digits and symbols that were never letters: `room 101` decodes to `room ioi` at the `basic` level.
- Because letters are matched case-insensitively going into leet, every substituted letter comes back lowercase after a round trip; only letters the level leaves alone keep their capitals (`Leet Speak` → `L337 5p34k` → `Leet speak`).
- For other playful text transforms, see [alternating case](/util/alternating_case/), [random case](/util/random_case/), and [unicode text style](/util/unicode_style/).
