---
title: AES Decrypt Online — Reverse AES-GCM & AES-CBC
description: Decrypt an AES-GCM or AES-CBC blob back to text or bytes using the password it was encrypted with, from base64 or hex.
---
## What does this tool decrypt?

This is the reverse of [AES encrypt](/util/aes_encrypt/): give it the base64 or hex blob that tool produced, the same password, and the same mode, key size, and iteration count, and it recovers the original text or bytes. It expects the wire format `salt(16) || iv(12 for GCM, 16 for CBC) || ciphertext`, re-derives the AES key from your password and the embedded salt with PBKDF2-SHA256, and decrypts. It does not know or guess the password, mode, or iteration count on its own — every one of those must match what was used to encrypt, or decryption fails.

## How it works

1. Whitespace is stripped from the input (so a blob wrapped across lines still decodes), and it is read as hex or base64 — `auto` (the default) picks whichever the text looks like, tolerating the URL-safe alphabet and missing `=` padding.
2. The salt and IV are sliced off the front according to the mode.
3. PBKDF2-SHA256 re-derives the AES key from your password, the salt, and the iteration count.
4. AES-GCM or AES-CBC decrypts the remaining bytes. GCM verifies its built-in authentication tag as part of this step, so a wrong password, wrong mode, or corrupted ciphertext is reported as a decryption failure rather than returning garbage silently. CBC has no tag: a wrong key is usually caught by an invalid-padding failure, but a modified blob can decrypt to altered plaintext with no error.
5. The plaintext bytes are decoded as UTF-8 text (the default; invalid UTF-8 raises an error), or returned as raw bytes when output is set to `bytes`.

```example
title: decrypt a blob produced by aes encrypt
params: {"password": "hunter2", "iterations": 1000}
input: +h7y7ZkH9CwYGGTiSlszGIehaPd912N5pRplQG5pSKozRrx5KFbu1piNEwBE1+7kl1RGdN3itmVFLQ==
output: secret message
```

```example
title: reading a hex-encoded blob
params: {"password": "correct horse", "format": "hex", "iterations": 1000}
input: 000102030405060708090a0b0c0d0e0f101112131415161718191a1b9f6ba70ef348f2bae7c34fc0fdc67910e79e3d863c6e49d809fdbf16202a385d326eec
output: attack at dawn 🌅
```

```example
title: AES-128-CBC with an explicit mode and key size
params: {"password": "correct horse", "mode": "CBC", "keyBits": "128", "iterations": 1000}
input: AAECAwQFBgcICQoLDA0ODyAhIiMkJSYnKCkqKywtLi/NpRsg44bi4aoOxyVmDE7U60iznPcaHhEDaaQ2qYQOJw==
output: attack at dawn 🌅
```

```example
title: empty input needs no password
input:
output:
```

## Options

- **password** — required; a blank password throws before anything is decrypted.
- **mode** — `GCM` (default) or `CBC`; must match what encrypted the blob.
- **key size (bits)** — `256` (default) or `128`; must also match.
- **pbkdf2 iterations** — default 100,000, up to 10,000,000; must be exactly the value used to encrypt, or the derived key is wrong and decryption fails.
- **input format** — `auto` (default) detects hex vs. base64, or force `base64`/`hex`.
- **output** — `text` (default) decodes the plaintext as UTF-8, or `bytes` returns the raw plaintext bytes unchanged (needed when the original data wasn't text).

## Common uses

- Recovering a note or config value that was encrypted with [aes encrypt](/util/aes_encrypt/).
- Testing that an AES-GCM or AES-CBC implementation elsewhere produces a compatible blob (same `salt || iv || ciphertext` layout and PBKDF2-SHA256 key derivation), by decrypting it here with the matching password and settings.
- Verifying tamper-detection: a GCM blob with even one flipped bit fails to decrypt rather than silently returning corrupted plaintext.

## Tips and pitfalls

- "Decryption failed" almost always means one of: wrong password, wrong mode, wrong key size, a wrong iteration count, or modified data — the tool cannot tell you which, since they all produce the same symptom (a failed authentication check for GCM, or invalid padding for CBC).
- If the blob is shorter than the minimum size for its mode (salt + IV + at least one block or auth tag), the input isn't a valid blob at all rather than a wrong password.
- Decrypted bytes that aren't valid UTF-8 raise an error when `output` is `text`; switch to `bytes` to inspect them safely rather than assuming your password is wrong.
- For hashing or fingerprinting instead of reversible encryption, see [hash](/util/hash/), [sha3](/util/sha3/), or [checksum](/util/checksum/).
