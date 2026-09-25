---
title: Columnar Transposition Cipher Encoder Online
description: Encrypt text with a keyed columnar transposition cipher, reading columns back in alphabetical key order with adjustable padding.
---
## What is a columnar transposition cipher?

Unlike a substitution cipher (which replaces letters), a transposition cipher keeps every original letter but rearranges their order. Columnar transposition does this by writing your text into a grid, one row at a time, with as many columns as there are letters in a keyword — then reading the grid back out column by column, in the alphabetical order of the keyword's letters. [Columnar transposition decode](/util/columnar_decode/) reverses this exactly, given the same key.

## How it works

With the key `ZEBRA` (5 letters) and the message `WEAREDISCOVEREDFLEEATONCE`, the tool:

1. Writes the message into a grid 5 columns wide, filling left to right, top to bottom.
2. Works out the alphabetical order of the key's letters: `ZEBRA` sorts to `A, B, E, R, Z`, which are columns 4, 2, 1, 3, 0 (counting from 0, left to right in the key).
3. Reads the grid one full column at a time in that order — column 4 first, then 2, then 1, then 3, then 0 — concatenating the letters into the ciphertext.

```example
title: encode with the default key ZEBRA
input: WEAREDISCOVEREDFLEEATONCE
output: EODAEASRENEIELORCEECWDVFT
```

When the text doesn't fill the grid exactly, the last row is short. The **pad character** fills those gaps so every column has the same height:

```example
title: padding the final row with X
params: {"key": "ZEBRA", "padChar": "X"}
input: HELLO WORLD
output: OLXLOXEWXLRXH D
```

Leaving the pad character empty keeps the grid ragged instead — some columns end up one row shorter than others, but the encoding is still fully reversible because [columnar transposition decode](/util/columnar_decode/) recomputes exactly which columns are short from the text length:

```example
title: no padding leaves ragged columns
params: {"key": "ZEBRA", "padChar": ""}
input: HELLO WORLD
output: OLLOEWLRH D
```

Repeated letters in the key keep their original left-to-right order when the alphabetical sort ties, so a key like `BANANA` still produces one unambiguous column order:

```example
title: a key with repeated letters (BANANA)
params: {"key": "BANANA", "padChar": "X"}
input: ABCDEFGHIJKL
output: BHDJFLAGCIEK
```

```example
title: empty input
input:
output:
```

## Options

- **key** — the keyword whose letters set both the number of columns and their read order; case doesn't matter (`zebra` and `ZEBRA` behave the same). An empty key is rejected, since there would be no columns to read.
- **pad character** — fills out the final row so the grid is rectangular. Only its first character is used if you type more than one. Leave it empty to keep the grid ragged instead of padding — this avoids the classic transposition-cipher ambiguity where you can't tell real pad characters from message characters that happen to match the pad.

## Common uses

- Classical cryptography exercises and cipher puzzles — columnar transposition is a staple of introductory cryptanalysis courses.
- Combining with a substitution cipher like [vigenère encode](/util/vigenere_encode/) or [caesar](/util/caesar/) to build a simple multi-stage classical cipher pipeline.
- Demonstrating how transposition (reordering) differs from substitution (replacing) as a cryptographic primitive.

## Tips and pitfalls

- This is a classical cipher with no cryptographic security by modern standards — a computer (or a patient human) can recover the key by trying column counts and checking readability. Use [AES encrypt](/util/aes_encrypt/) for real confidentiality.
- If your plaintext might itself end in the pad character, use an empty pad instead of a fixed one: a padded round-trip can't distinguish "real trailing X" from "padding X", but the ragged (no-pad) mode has no such ambiguity.
- The grid is built from Unicode code points, not UTF-16 units, so multi-byte characters and emoji occupy exactly one cell each and survive the round trip intact.
