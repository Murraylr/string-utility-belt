---
title: XOR Cipher Online: Encrypt & Decrypt with a Key
description: Apply a repeating-key XOR cipher to text or bytes, with text, hex, base64, or decimal keys and matching output formats.
---
## What is a XOR cipher?

XOR (exclusive or) is a bitwise operation where `a XOR b XOR b` always equals `a`. Apply the same key twice and you're back where you started. A repeating-key XOR cipher exploits exactly that: it XORs each byte of your data with the next byte of a key, repeating the key as many times as needed to cover the whole input. It's essentially a Vigenère cipher over bytes, and because it's its own inverse, there's a single tool here for both directions: encrypting and decrypting are the same operation with the same key.

## How it works

1. Your input is converted to bytes: text as UTF-8, or raw bytes passed through unchanged (for example, bytes piped in from a previous step).
2. The key is decoded into its own byte sequence from whichever format you chose: plain text (UTF-8), hex, base64, or a list of decimal byte values.
3. Each input byte is XORed with the key byte at the same position modulo the key length, so a short key repeats to cover longer input.
4. The result is emitted as hex, base64, raw bytes, or UTF-8 text.

```example
title: encrypt to hex with a text key
params: {"key": "lemon", "keyFormat": "text", "output": "hex"}
input: Attack at dawn
output: 2d11190e0d07450c1b4e08041a01
```

```example
title: the same result as base64
params: {"key": "lemon", "keyFormat": "text", "output": "base64"}
input: Attack at dawn
output: LREZDg0HRQwbTggEGgE=
```

```example
title: a key given as decimal bytes instead of text
params: {"key": "107", "keyFormat": "decimal", "output": "hex"}
input: hi
output: 0302
```

```example
title: empty input
params: {"key": "k"}
input:
output:
```

## Options

- **key**: required; XORing with an empty key throws an error rather than returning the input unchanged.
- **key format**: `text` (default) reads the key as UTF-8. `hex` accepts optional separators like spaces, colons, or dashes between byte pairs. `base64` tolerates both the standard and URL-safe alphabets, with or without padding. `decimal` reads space- or comma-separated byte values from 0 to 255.
- **output**: `hex` (default), `base64`, `bytes` (the raw XORed bytes, useful when feeding another binary-aware step), or `text`, which decodes the result as UTF-8 and throws if that fails. XOR output is frequently not valid text, so this surfaces the mismatch instead of silently corrupting it with replacement characters.

## Common uses

- Simple "obfuscation" of strings embedded in scripts or configs where the goal is avoiding a plain-text grep match, not real security.
- Teaching how stream ciphers and one-time pads work, and why key reuse is dangerous (XORing two ciphertexts that share a key cancels the key out and leaks structure).
- Quick reversible scrambling in puzzles, CTF challenges, and toy protocols.

## Tips and pitfalls

- **The key format only applies to the key, not the input.** If you XOR-encrypted something to hex or base64 output, decrypting it means feeding that *decoded* back in as bytes, typically via [hex decode](/util/hex_decode/), or [base64url decode](/util/base64url_decode/) with its output set to `bytes` (it reads the standard alphabet too; plain base64 decode returns text and rejects binary data). Don't paste the hex or base64 text straight back into this tool's input box, which would XOR the literal digit characters instead of the original bytes.
- XOR with a short, reused key is not secure. Any repeating-key XOR cipher is broken by standard techniques (frequency analysis per key-length offset) once there's enough ciphertext; treat this as a puzzle-grade cipher, not encryption. Use [AES encrypt](/util/aes_encrypt/) when confidentiality actually matters.
- Because XOR is its own inverse, running the same key through this tool twice with `output: bytes` (or matching text) returns the original input. That is a good way to sanity-check that a key and format are correct.
- If `output: text` throws "not valid utf-8," that's expected for most XOR results. Switch to `hex`, `base64`, or `bytes` to see the actual data.
