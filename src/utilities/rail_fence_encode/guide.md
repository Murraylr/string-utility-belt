---
title: Rail Fence Cipher Encoder Online — Zigzag Cipher
description: Encrypt text with the rail fence zigzag transposition cipher, choosing the number of rails and a starting offset.
---
## What is the rail fence cipher?

The rail fence cipher writes your message in a zigzag across a set number of horizontal "rails," then reads the rails back out one at a time, top to bottom, left to right within each rail. Like [columnar transposition](/util/columnar_encode/), it's a transposition cipher: it reorders the letters of your message without changing or replacing any of them.

## How it works

With 3 rails, the classic example `WEAREDISCOVEREDFLEEATONCE` is written zigzagging down and back up across the rails:

```
W . . . E . . . C . . . R . . . L . . . T . . . E
. E . R . D . S . O . E . E . F . E . A . O . C .
. . A . . . I . . . V . . . D . . . E . . . N . .
```

Reading rail 0, then rail 1, then rail 2 gives the ciphertext:

```example
title: encode with 3 rails
params: {"rails": 3, "offset": 0}
input: WEAREDISCOVEREDFLEEATONCE
output: WECRLTEERDSOEEFEAOCAIVDEN
```

An **offset** shifts where the zigzag starts, as if you began reading from partway down or up the fence instead of the top rail:

```example
title: starting the zigzag one step in with offset
params: {"rails": 3, "offset": 1}
input: ABCDEF
output: DACEBF
```

With only 1 rail there's nothing to zigzag, so the text passes through unchanged:

```example
title: a single rail leaves the text unchanged
params: {"rails": 1}
input: ABCDEF
output: ABCDEF
```

```example
title: empty input
params: {"rails": 5}
input:
output:
```

## Options

- **rails** — how many horizontal lines the zigzag uses; must be a whole number from 1 to 10,000. Default is 3. More rails spread the letters further apart before you read them back.
- **offset** — where in the zigzag pattern to start, as an integer (negative values are allowed and wrap around the cycle). Default is 0, the standard starting position at the top rail.

## Common uses

- Classical cryptography exercises alongside [columnar transposition](/util/columnar_encode/) and [vigenère](/util/vigenere_encode/) as an introduction to transposition ciphers.
- Puzzle hunts and escape rooms that want a hand-solvable but non-obvious text scramble.
- Testing or teaching zigzag-pattern algorithms more generally, since the underlying "read by diagonal/zigzag" technique shows up outside cryptography too (for example, LeetCode's "ZigZag Conversion" problem is the same pattern).

## Tips and pitfalls

- Like other classical transposition ciphers, rail fence offers no real security — with a small number of possible rail counts, an attacker can just try them all. Use [AES encrypt](/util/aes_encrypt/) for anything that needs genuine confidentiality.
- Both the rail count and the offset must match exactly on encode and decode; [rail fence decode](/util/rail_fence_decode/) needs the same two values to recover the original text.
- The tool works on Unicode code points, so multi-byte characters and emoji occupy one position in the zigzag each and are never split or corrupted.
- A very large rail count (at least the text length) is harmless — at offset 0 every character lands on its own rail and the text comes out unchanged, and the tool stays fast however large `rails` is set, since the work scales with the text length, not the rail count.
