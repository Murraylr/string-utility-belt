---
title: Reverse a String Online: Flip Text Backwards
description: Reverse the character order of any text online and see exactly how string reversal handles Unicode, emoji and combining marks.
---
## What does reversing a string mean?

Reversing a string flips the order of its characters so the last character becomes the first and the first becomes the last. It is a classic beginner programming exercise (`"hello"` becomes `"olleh"`), but it also shows up in real tasks: checking whether a value is a palindrome, building a simple obfuscation step, or eyeballing whether two strings are mirror images of each other. This tool reverses the whole input as a single string; if you want to reverse the order of *words* instead of characters, use [reverse word order](/util/reverse_words/), and if you want to reverse the order of *lines*, use [reverse line order](/util/line_reverse/).

## How it works

The tool splits the input into Unicode code points, reverses that list, and joins it back together. Splitting by code point (rather than by raw UTF-16 unit) matters because JavaScript strings are UTF-16 internally, and characters outside the Basic Multilingual Plane (most emoji, some rare CJK ideographs, mathematical alphanumeric symbols) are stored as a *pair* of 16-bit units (a surrogate pair). Reversing naively unit-by-unit would split each such character in half, corrupting it. Reversing by code point keeps each one intact:

```example
title: reverse a plain word
input: hello
output: olleh
```

```example
title: accented characters reverse correctly
input: café
output: éfac
```

```example
title: a single-codepoint emoji stays intact
input: 🎉 hi
output: ih 🎉
```

An empty string reverses to itself, and applying the tool twice always returns the original text. Reversal is its own inverse.

```example
title: empty input stays empty
input: 
output: 
```

## What it does not do

Code-point-safe is not the same as *grapheme-safe*. Some visible "characters" are actually built from several code points in sequence: a base letter followed by a combining accent mark, a flag made of two regional-indicator code points, or a multi-person emoji joined with zero-width joiners (ZWJ). Reversing moves each code point independently, so a sequence like that can come out with its pieces in the wrong order relative to each other, even though no individual code point is corrupted. This is a limitation of character-level string reversal in general, not something specific to this tool. The same thing happens with `[...s].reverse().join('')` in plain JavaScript. Accented letters are safe when the text is precomposed (an accented letter is one code point, as it usually is when typed normally rather than assembled from a base letter plus a separate accent); flags, skin-tone emoji and ZWJ sequences are affected either way.

## Common uses

- Quick palindrome checks: reverse a string and compare it to the original.
- A trivial, non-cryptographic way to obscure text. Never use it to protect anything sensitive, since it is instantly reversible by definition.
- A sanity check when debugging string-indexing code, to see a value's characters in the opposite order.

## Tips and pitfalls

- Reversal only touches the order of characters, not their case or content. Pair it with [swap case](/util/swap_case/) or [format case](/util/format_case/) if you need to change casing too.
- For reversing word order instead of character order, use [reverse word order](/util/reverse_words/); for shuffling lines, words or characters randomly rather than reversing them, use [shuffle](/util/shuffle/).
- Because reversal is its own inverse, running the same input through this step twice in a pipeline is a no-op. That is useful to remember if a pipeline ever seems to do nothing.
- If your text contains combining accents and you need them to stay on their letters, normalize it to NFC first with [normalize](/util/normalize/) so each accented letter becomes a single code point wherever Unicode has a precomposed form. Normalization does not help with flags or multi-part emoji.
