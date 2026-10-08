---
title: Rail Fence Cipher Decoder Online: Zigzag Cipher
description: Decrypt rail fence zigzag ciphertext back to plaintext using the same number of rails and offset it was encrypted with.
---
## What does this tool decrypt?

This reverses [rail fence encode](/util/rail_fence_encode/): a transposition cipher that writes a message in a zigzag across a number of rails and then reads the rails back out top to bottom. Given the ciphertext, the same rail count, and the same starting offset, this tool rebuilds the zigzag pattern and reads the letters back out in their original order.

## How it works

The rail fence cipher doesn't reorder letters randomly. It follows a fixed, predictable zigzag path determined entirely by the rail count, the offset, and the text length. To decode:

1. The tool recomputes exactly which rail each original position would have landed on, using the same zigzag walk the encoder used.
2. That tells it how many ciphertext characters belong to each rail, and in what order the encoder concatenated them.
3. It then places the ciphertext characters back into their original positions according to that map, recovering the plaintext.

```example
title: decode with 3 rails
params: {"rails": 3, "offset": 0}
input: WECRLTEERDSOEEFEAOCAIVDEN
output: WEAREDISCOVEREDFLEEATONCE
```

```example
title: decoding with a non-zero offset
params: {"rails": 3, "offset": 1}
input: DACEBF
output: ABCDEF
```

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

- **rails**: must match the rail count used to encode; a whole number from 1 to 10,000. Default is 3.
- **offset**: must match the starting offset used to encode. Default is 0. Offsets that differ by a whole zigzag cycle (2 × rails − 2, so 4 for 3 rails) are equivalent: with 3 rails, `-1` and `3` decode the same way.

## Common uses

- Recovering plaintext from ciphertext produced by [rail fence encode](/util/rail_fence_encode/).
- Solving rail fence puzzles by hand-verifying a guessed rail count against the tool's output.
- Learning how a zigzag transposition can be reversed algebraically rather than by physically redrawing the zigzag.

## Tips and pitfalls

- If you guess the wrong rail count or offset, the tool doesn't error. It just produces a different, unreadable rearrangement, since almost any rail count between 2 and the text length is technically valid. Try a small range of rail counts and look for readable output, which is how this cipher is typically broken.
- Both settings must match the encoder; the tool does not detect them from the ciphertext for you.
- The tool operates on Unicode code points rather than UTF-16 units, so multi-byte characters and emoji move as whole units and are never corrupted or split during the rebuild.
