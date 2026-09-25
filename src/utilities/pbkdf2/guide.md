---
title: PBKDF2 Key Derivation Online — Hash Generator
description: Derive a PBKDF2 key from a password online with SHA-1, SHA-256 or SHA-512, a salt and an iteration count, verified against the RFC 6070 vectors.
---
## What is PBKDF2?

PBKDF2 (Password-Based Key Derivation Function 2, [RFC 8018](https://datatracker.ietf.org/doc/html/rfc8018)) turns a password and a salt into a fixed-length key by running HMAC over them repeatedly — thousands or millions of times — so that testing one password guess is deliberately expensive. It is one of the oldest and most widely standardized password-based KDFs, used in WPA2-Personal Wi-Fi, many disk-encryption tools, and countless password-storage schemes, largely because it only needs a hash function and is straightforward to implement correctly. This tool derives the key using the browser's built-in Web Crypto `PBKDF2` implementation, so the numbers match what any standards-compliant library would produce.

## How it works

Give it a password as the input, a salt, an algorithm, an iteration count, and the number of bytes you want back:

```example
title: hex output
input: password
params: {"algorithm": "SHA-256", "salt": "salt", "iterations": 1000, "keyLength": 16, "output": "hex"}
output: 632c2812e46d4604102ba7618e9d6d7d
```

The same derivation as base64 instead of hex:

```example
title: base64 output
input: password
params: {"algorithm": "SHA-256", "salt": "salt", "iterations": 1000, "keyLength": 16, "output": "base64"}
output: YywoEuRtRgQQK6dhjp1tfQ==
```

This implementation reproduces the official [RFC 6070](https://datatracker.ietf.org/doc/html/rfc6070) PBKDF2-HMAC-SHA-1 test vectors exactly, which is the standard way to confirm a PBKDF2 implementation is wired up correctly:

```example
title: RFC 6070 test vector (SHA-1, 1 iteration)
input: password
params: {"algorithm": "SHA-1", "salt": "salt", "iterations": 1, "keyLength": 20}
output: 0c60c80f961f0e71f3a9b524af6012062fe037a6
```

With every parameter left at its documented default (SHA-256, an empty salt, 100,000 iterations, a 32-byte key, hex output):

```example
title: using the documented defaults
input: correct horse
output: c0921865c3557ec5906c04fe7178f533f0f1565885561a6485f8d6d30fdc8487
```

## Options

- **algorithm** — the hash PBKDF2's internal HMAC uses: `SHA-1`, `SHA-256` (default), or `SHA-512`.
- **salt** — UTF-8 text fed into the derivation; an empty salt is accepted but defeats the point of salting in real use, since identical passwords then derive identical keys and an attacker's precomputed tables work against every user.
- **iterations** — how many HMAC rounds to run; default `100000`, from 1 to 10,000,000. This is the main cost knob: doubling it doubles the time (and the time an attacker needs per guess). The default is not a security recommendation — current guidance such as OWASP's Password Storage Cheat Sheet calls for considerably more iterations for password storage.
- **key length (bytes)** — the size of the derived key, default `32` bytes (256 bits), capped at 1024 bytes. PBKDF2 makes a longer key by computing extra blocks, each costing the full iteration count, but an attacker only needs the first block to test a guess — so asking for more than the hash's own output size (20 bytes for SHA-1, 32 for SHA-256, 64 for SHA-512) slows you down without slowing them.
- **output** — `hex` (default) or `base64`.

## Common uses

- Deriving an encryption key from a user's passphrase before using it with a symmetric cipher.
- Storing password verifiers in systems that specifically require PBKDF2 for compliance reasons (it is the password-based KDF that NIST SP 800-132 approves).
- Comparing PBKDF2's iteration-based cost model against [argon2 hash](/util/argon2_hash/) (memory-hard) and [bcrypt hash](/util/bcrypt_hash/).

## Tips and pitfalls

- PBKDF2 has no built-in memory cost, which makes it comparatively cheap to attack on GPUs and ASICs next to Argon2 or bcrypt for the same time spent by the defender — favor [argon2 hash](/util/argon2_hash/) for new designs when you have the choice, and reserve PBKDF2 for contexts that specifically require it.
- Always use a unique, random salt per password in real use; the fixed `"salt"` value (and the empty salt of the defaults example) above exist only so the output here is reproducible — and, for the SHA-1 example, matches RFC 6070.
- Raising the iteration count is the most direct way to keep pace with faster hardware over time — periodically increasing it (and re-deriving stored keys on next login) is standard practice.
- The underlying step is [hmac](/util/hmac/), chained and XOR-ed together over the iterations; if you only need a single keyed signature rather than a slow key derivation, use that instead.
