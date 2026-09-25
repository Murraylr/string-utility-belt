---
title: Vigenère Cipher Encoder Online — Keyword Cipher
description: Encrypt text with the Vigenère polyalphabetic cipher using a repeating keyword, with options for case and punctuation handling.
---
## What is the Vigenère cipher?

Where a [Caesar cipher](/util/caesar/) shifts every letter by the same fixed amount, the Vigenère cipher shifts each letter by an amount that comes from a repeating keyword — making it a "polyalphabetic" substitution cipher. Historically called "le chiffre indéchiffrable" (the indecipherable cipher), it resisted simple frequency analysis for centuries longer than single-shift ciphers, because the same plaintext letter can encrypt to different ciphertext letters depending on its position relative to the key.

## How it works

Each letter of the keyword becomes a shift amount: `A`/`a` = 0, `B`/`b` = 1, up to `Z`/`z` = 25. The keyword repeats for as long as needed, and each letter of your message is shifted (like a Caesar cipher) by the next shift in that sequence.

With key `LEMON` (shifts `L`=11, `E`=4, `M`=12, `O`=14, `N`=13) and message `ATTACKATDAWN`:

```
A T T A C K A T D A W N
L E M O N L E M O N L E
-----------------------
L X F O P V E F R N H R
```

```example
title: encrypt with the default key KEY
input: hello
output: rijvs
```

```example
title: the classic LEMON / ATTACKATDAWN example
params: {"key": "LEMON"}
input: ATTACKATDAWN
output: LXFOPVEFRNHR
```

```example
title: preserveCase off uppercases the whole result
params: {"key": "KEY", "preserveCase": false}
input: Hello
output: RIJVS
```

By default, spaces and punctuation are skipped without consuming a position in the key. Turning that off makes every character — including spaces — advance the key, which changes the result:

```example
title: skipNonLetters off lets spaces advance the key
params: {"key": "BC", "skipNonLetters": false}
input: ab cd
output: bd ee
```

```example
title: empty input
input:
output:
```

## Options

- **key** — the repeating keyword. Only its letters `a`–`z` count as shifts; digits, punctuation, and spaces inside the key itself are dropped (so `L-E.M.O.N` still keys as `LEMON`). A key with no letters at all is rejected.
- **preserve case** — on by default, so lowercase input shifts within lowercase and uppercase within uppercase. Off uppercases every shifted letter.
- **skip non-letters** — on by default: spaces, digits, and punctuation in your message pass through untouched *and* don't consume a position in the key, so the key stays aligned with the letters around them. Turning it off makes every character, letter or not, advance the key position — non-letters still aren't shifted themselves, but the key marches on through them.

## Common uses

- Classical cryptography education — Vigenère is the standard next step after Caesar shifts when teaching polyalphabetic substitution and how the Kasiski examination breaks it.
- Puzzle hunts and games wanting a keyword-based cipher that's harder to eyeball than a straight letter shift.
- Encoding short messages for puzzles where the "key" is part of the fun to guess.

## Tips and pitfalls

- Vigenère is not secure by modern standards. Given enough ciphertext, the key length can be recovered (Kasiski examination or index of coincidence), after which each position reduces to a simple Caesar shift. Use [AES encrypt](/util/aes_encrypt/) for real confidentiality.
- The `skipNonLetters` setting must match on both ends: encoding with it off and decoding with it on (or vice versa) misaligns the key at the first non-letter and garbles the letters after it.
- Accented letters (`é`, `ñ`) are not part of the `a`–`z` key alphabet the tool understands — they pass through as ordinary "non-letters" in the message, and if they appear in the key itself, they're silently dropped rather than treated as key letters.
- [Vigenère decode](/util/vigenere_decode/) reverses this, given the same key and skip-non-letters setting. If you encoded with preserve case off, the original lowercase letters are gone for good — decoding returns them uppercase.
