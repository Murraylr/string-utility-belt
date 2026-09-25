---
title: Caesar Cipher & ROT13 Online — Shift Text Tool
description: Shift letters by any amount with the Caesar cipher, including ROT13, ROT47, and alphanumeric rotation, with live previews.
---
## What is the Caesar cipher?

The Caesar cipher shifts every letter forward through the alphabet by a fixed number of positions, wrapping back to the start when it runs off the end — named after Julius Caesar, who reportedly used a shift of 3 for military messages. `ROT13` (shift 13) is the most common variant online, popular because applying it twice returns the original text: with a 26-letter alphabet, shifting by 13 twice is a full 26-letter loop. This tool generalizes the idea with a configurable shift and three alphabets to shift over.

## How it works

For each character, the tool checks which alphabet it belongs to and rotates it within that alphabet only; everything else passes through unchanged:

- **letters** (default) — shifts `A`–`Z` and `a`–`z`, each within its own case.
- **rot47** — shifts across all 94 printable ASCII characters (`!` through `~`), so digits and punctuation rotate too, not just letters. Case has no separate meaning here since the whole printable range is one alphabet. The shift is still whatever you set (13 by default), so standard ROT47 means this mode with a shift of `47`.
- **alphanumeric** — shifts letters as above, plus digits `0`–`9` on their own 10-wide wheel.

A shift of `13` is the ROT13 default. Negative shifts rotate the other way, and any shift wraps automatically (`26` behaves the same as `0` for letters).

```example
title: rot13 (the default shift of 13)
input: Hello, World!
output: Uryyb, Jbeyq!
```

```example
title: shift 3, the original Caesar shift
params: {"shift": 3}
input: Attack at Dawn
output: Dwwdfn dw Gdzq
```

```example
title: rot47 shifts digits and punctuation too
params: {"shift": 47, "mode": "rot47"}
input: Hello, World! 123
output: w6==@[ (@C=5P `ab
```

```example
title: alphanumeric mode also rotates digits 0-9
params: {"shift": 5, "mode": "alphanumeric"}
input: abc123
output: fgh678
```

```example
title: preserveCase off uppercases the whole result
params: {"shift": 3, "preserveCase": false}
input: Hello
output: KHOOR
```

```example
title: non-latin characters and emoji are untouched
params: {"shift": 1}
input: héllo 😀 Ω
output: iémmp 😀 Ω
```

## Options

- **shift** — how many positions to rotate; defaults to `13`. Any integer works, including negative numbers and values larger than the alphabet size (they wrap).
- **alphabet** — `letters` (default), `rot47`, or `alphanumeric`, as described above.
- **preserve case** — on by default, so `a` shifts within lowercase and `A` within uppercase. Turning it off uppercases every shifted letter. It has no effect in `rot47` mode, since that mode's alphabet already treats case as just another character.

## Common uses

- ROT13 for lightly obscuring spoilers, puzzle answers, or forum content that shouldn't be readable at a glance.
- ROT47 for scrambling text that includes punctuation and digits along with letters.
- Teaching classical cryptography and frequency analysis, since a Caesar shift is broken almost instantly by trying all 26 (or 94) possibilities.

## Tips and pitfalls

- This is not encryption. A Caesar shift has only a handful of distinct keys (26 in `letters` mode, 94 in `rot47`, 130 in `alphanumeric`), so it can be brute-forced in seconds. Use [AES encrypt](/util/aes_encrypt/) for anything that actually needs to stay secret.
- Only the characters in the selected alphabet move; accented letters, most punctuation (outside `rot47`), and emoji always pass through unchanged.
- For a keyword-based cipher that resists simple brute force better (though still not secure), see [vigenère encode](/util/vigenere_encode/). For a fixed, keyless mirror instead of a shift, see [atbash](/util/atbash/).
