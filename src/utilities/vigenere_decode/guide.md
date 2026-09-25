---
title: Vigenère Cipher Decoder Online — Keyword Cipher
description: Decrypt Vigenère ciphertext back to plaintext with the keyword it was encrypted under, matching the original options.
---
## What does this tool decrypt?

This reverses [Vigenère encode](/util/vigenere_encode/): a classical polyalphabetic substitution cipher where each letter is shifted by an amount taken from a repeating keyword, rather than by one fixed amount as in a [Caesar cipher](/util/caesar/). Give this tool the same keyword used to encrypt, and it subtracts the same shifts back out instead of adding them.

## How it works

The keyword is turned into the same sequence of shifts as encoding (`A`/`a` = 0 up to `Z`/`z` = 25, repeating for the length of the message), but each letter of the ciphertext is shifted **backward** by its corresponding key letter instead of forward:

```example
title: decrypt with the default key KEY
input: rijvs
output: hello
```

```example
title: the classic LEMON / LXFOPVEFRNHR example
params: {"key": "LEMON"}
input: LXFOPVEFRNHR
output: ATTACKATDAWN
```

```example
title: preserveCase off uppercases the whole result
params: {"key": "KEY", "preserveCase": false}
input: Rijvs
output: HELLO
```

```example
title: skipNonLetters off, matching how it was encoded
params: {"key": "BC", "skipNonLetters": false}
input: bd ee
output: ab cd
```

```example
title: empty input
input:
output:
```

## Options

- **key** — must be the same keyword used to encrypt, case-insensitively (`LEMON` and `lemon` decrypt identically). Only its `a`–`z` letters count; other characters in the key are ignored. A key with no letters is rejected.
- **preserve case** — on (default), each decrypted letter keeps the case it has in the ciphertext. Off uppercases every decrypted letter. It only affects letter case, never which letters come out, so it does not need to match the encoder's setting.
- **skip non-letters** — must match the encoder's setting exactly. On (default), spaces and punctuation don't consume a key position; off means they did, and decoding must walk the key the same way to stay aligned.

## Common uses

- Recovering the original text from ciphertext produced by [Vigenère encode](/util/vigenere_encode/).
- Working through classical cryptography puzzles once a candidate keyword has been guessed or recovered (for example via Kasiski examination).
- Verifying that a Vigenère implementation elsewhere is compatible with this one, by round-tripping known plaintext.

## Tips and pitfalls

- A wrong key doesn't produce an error — it produces different, unreadable gibberish, since any key with at least one letter is accepted. There's no built-in way to tell "wrong key" apart from "correctly decrypted nonsense" other than reading the result.
- If `skipNonLetters` doesn't match what was used to encrypt, decoding still runs but the key falls out of alignment at the first space, digit, or punctuation mark, garbling the letters after it — this is not a setting you can guess independently of the ciphertext's origin. (`preserveCase` only changes the output's letter case.)
- Like the encoder, this only shifts ASCII letters `a`–`z`/`A`–`Z`; accented letters and other scripts pass through unchanged. They never use a key letter themselves, but with skip non-letters off they still advance the key position like any other non-letter.
