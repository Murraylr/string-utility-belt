---
title: ROT13 Encoder/Decoder: Caesar Cipher Online
description: Apply ROT13 to text online: shift every letter 13 places through the alphabet, leaving digits and punctuation untouched. Encoding and decoding are identical.
---
## What is ROT13?

ROT13 ("rotate by 13") is the Caesar cipher with a fixed shift of 13: every letter is replaced by the one 13 places further along the alphabet, wrapping from `Z` back to `A`. Because the Latin alphabet has 26 letters and 13 is exactly half of that, applying ROT13 twice returns the original text, so encoding and decoding are the same operation. It has no cryptographic strength at all; its long-standing use on Usenet and early internet forums was to hide spoilers, puzzle answers or offensive jokes from a casual glance, not from anyone determined to read them.

## How does ROT13 work?

Each letter is shifted 13 places within its own case, and everything else (digits, punctuation, spaces, non-Latin characters) passes through completely unchanged.

```example
title: basic
input: Hello, World!
output: Uryyb, Jbeyq!
```

```example
title: wraps around from z back to a
input: xyz
output: klm
```

`x`, `y` and `z` sit within 13 places of the end of the alphabet, so the shift wraps around: `x` (24th letter) + 13 lands on the 37th position, which wraps to the 11th letter, `k`.

```example
title: only letters are affected
input: hello, world! 123
output: uryyb, jbeyq! 123
```

Case is preserved independently for each letter: uppercase letters shift within `A`–`Z`, lowercase letters shift within `a`–`z`, so `Hello` becomes `Uryyb` rather than losing its capitalization.

## How does the cipher decode itself?

Because the shift is exactly half of the alphabet's length, running the same ROT13 operation on already-encoded text undoes it. Feed `Uryyb, Jbeyq!` back through this tool and you get `Hello, World!` again. There is no separate "decode" mode, and none is needed.

## Common uses

- Obscuring spoilers, puzzle solutions or punchlines in forum posts and emails so they are not readable at a glance, while still being trivially decodable by anyone curious.
- Quick, reversible text scrambling for programming exercises and teaching how substitution ciphers work.
- Reading data that is stored ROT13-obscured, such as the program names Windows records under the registry's `UserAssist` key.

## Tips and pitfalls

- ROT13 provides no security whatsoever. It is a fixed, well-known substitution with no key, so treat it purely as light obfuscation, never as a way to protect sensitive information.
- Numbers, spaces and punctuation are never touched, so a ROT13'd sentence keeps its original word boundaries and structure, which makes many ROT13'd sentences readable "at a glance" faster than you might expect once you know the trick.
- If you need a cipher with an adjustable shift amount instead of a fixed 13, or one driven by a keyword, look at [caesar](/util/caesar/) (any shift, plus ROT47) or [vigenere encode](/util/vigenere_encode/) (a shift that varies with a repeating keyword). Both are still classical ciphers with no real security, but they are configurable where ROT13 is not.
- ROT13 only shifts the 26 letters of the basic Latin alphabet; accented letters and non-Latin scripts pass through unchanged rather than being rotated in their own alphabet.
