---
title: AES Encrypt Online: AES-256-GCM & AES-CBC Tool
description: Encrypt text or bytes with AES-256/128 in GCM or CBC mode, keyed by a password through PBKDF2, entirely in your browser.
---
## What is AES encryption?

AES (Advanced Encryption Standard) is the symmetric block cipher used almost everywhere modern software needs confidentiality: TLS, disk encryption, password managers, VPNs. "Symmetric" means the same secret unlocks what it locked, unlike RSA or other public-key schemes. This tool doesn't ask you for a raw AES key directly. Instead you give it a password, and it derives a proper AES key from that password using PBKDF2-SHA256, so you can use a memorable phrase instead of managing 32 random bytes. [AES decrypt](/util/aes_decrypt/) reverses exactly what this tool produces.

## How this tool encrypts

Each time you run it, the tool:

1. Generates a random 16-byte **salt** and a random **IV** (initialization vector): 12 bytes for GCM, 16 bytes for CBC.
2. Derives an AES key from your password and the salt using PBKDF2-SHA256 with the chosen iteration count.
3. Encrypts your text (converted to UTF-8 bytes) or raw bytes with AES in the chosen mode and key size.
4. Concatenates `salt || iv || ciphertext` and encodes the result as base64 or hex. In GCM mode the ciphertext ends with a 16-byte authentication tag; in CBC mode it is PKCS#7-padded to a whole number of 16-byte blocks.

Because the salt and IV are freshly randomized on every run, encrypting the same text with the same password twice produces two completely different outputs. This is a deliberate security property (semantic security), not a bug. It's also why the examples below show a pattern rather than one fixed string.

```example
title: encrypt text (ciphertext differs on every run)
params: {"password": "hunter2", "iterations": 1000}
input: secret message
output-matches: ^[A-Za-z0-9+/]+=*$
```

```example
title: hex output instead of base64
params: {"password": "pw", "output": "hex", "iterations": 1000}
input: hello
output-matches: ^[0-9a-f]+$
```

```example
title: AES-128-CBC instead of the AES-256-GCM default
params: {"password": "pw", "mode": "CBC", "keyBits": "128", "iterations": 1000}
input: hello
output-matches: ^[A-Za-z0-9+/]+=*$
```

Empty input always encrypts to an empty string, even without a password set, so a freshly added pipeline step should not show an error before you've typed anything:

```example
title: empty input needs no password
input:
output:
```

## Options

- **password**: required; encrypting with a blank password throws an error.
- **mode**: `GCM` (default) appends an authentication tag, so any change to the blob, or the wrong password/key, is detected on decrypt. `CBC` has no integrity check: a wrong key is usually caught only because the padding comes out invalid, and a modified ciphertext can decrypt to altered plaintext without any error.
- **key size (bits)**: `256` (default) or `128`.
- **pbkdf2 iterations**: default 100,000, up to 10,000,000. Higher values make password-guessing slower but also slow down every encrypt and decrypt; the same count must be used to decrypt. The default is below the 600,000 that OWASP's password-storage guidance recommends for PBKDF2-SHA256, so raise it (on both ends) if your password is not long and random.
- **output**: `base64` (default) or `hex`.

## Common uses

- Sharing a sensitive note or config snippet with someone who has the password, over a channel you don't fully trust.
- Encrypting a value before storing it somewhere insecure (a public gist, a chat log).
- Learning or demonstrating how password-based AES encryption is structured.

## Tips and pitfalls

- There is no password recovery. Losing the password means the ciphertext is permanently unreadable.
- Prefer GCM over CBC for new work: CBC on its own is malleable (flipping ciphertext or IV bits predictably changes the decrypted text), and it gives you no reliable way to tell a tampered blob from a wrong password.
- The iteration count, mode, and key size are not stored in the output. You must remember and re-enter them to decrypt. Only the salt and IV travel with the ciphertext.
- This is encryption, not hashing: if you only need to detect changes or fingerprint data, use [hash](/util/hash/) or [checksum](/util/checksum/) instead, which are far cheaper and don't require managing a secret.
- For a simpler (and much weaker) reversible transform that needs no real cryptography, see [xor cipher](/util/xor_cipher/); it is not a substitute for AES when confidentiality actually matters.
