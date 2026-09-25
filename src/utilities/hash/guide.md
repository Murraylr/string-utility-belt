---
title: SHA-256 Hash Generator Online — SHA-1/384/512
description: Generate a SHA-1, SHA-256, SHA-384, or SHA-512 hash of text or bytes using the browser's built-in WebCrypto API.
---
## What is a cryptographic hash?

A cryptographic hash function turns input of any size into a fixed-length digest, such that the same input always produces the same digest, a tiny change in input produces a completely different digest, and it's computationally infeasible to work backward from the digest to the input, or to find two different inputs that hash to the same digest. This tool computes SHA-1, SHA-256, SHA-384, and SHA-512 — the SHA-2 family plus its predecessor SHA-1 — using the browser's native WebCrypto implementation, so the numbers match what any standard library produces.

## How it works

Your text is encoded as UTF-8 bytes (raw bytes from a previous step are hashed as-is), passed to `crypto.subtle.digest`, and the resulting digest is shown as lowercase hexadecimal.

```example
title: SHA-256 of "hello" (the default algorithm)
params: {"algo": "SHA-256"}
input: hello
output: 2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824
```

```example
title: SHA-1, a shorter, older digest
params: {"algo": "SHA-1"}
input: hello
output: aaf4c61ddcc5e8a2dabede0f3b482cd9aea9434d
```

```example
title: SHA-512, the widest digest in this family
params: {"algo": "SHA-512"}
input: abc
output: ddaf35a193617abacc417349ae20413112e6fa4e89a97ea20a9eeee64b55d39a2192992a274fc1a836ba3c23a3feebbd454d4423643ce80e2a9ac94fa54ca49f
```

```example
title: empty input still produces a full-length digest
params: {"algo": "SHA-256"}
input:
output: e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
```

## Options

- **algorithm** — `SHA-1`, `SHA-256` (default), `SHA-384`, or `SHA-512`. Digest length scales with the name: SHA-1 is 160 bits (40 hex characters), SHA-256 is 256 bits (64 characters), SHA-384 is 384 bits (96 characters), and SHA-512 is 512 bits (128 characters).

## Common uses

- Generating checksums to verify file integrity, matching the `sha256sum`/`shasum` output you'd get from a command line.
- Producing content-addressed identifiers — using a hash of data as its own lookup key, as Git does (Git uses SHA-1 by default, with SHA-256 as an opt-in repository format, and hashes a short header along with the content, so its object IDs won't match a plain hash of the file).
- Fingerprinting text for comparison, deduplication, or cache keys, without storing the original content.
- Building blocks for HMAC-based authentication; see [hmac](/util/hmac/) if you need a keyed variant.

## Tips and pitfalls

- **SHA-1 is broken for collision resistance.** Researchers have demonstrated practical SHA-1 collisions; don't rely on it anywhere an attacker might deliberately craft colliding inputs (digital signatures, certificate fingerprints). It's included here for compatibility and legacy verification, not for new security-sensitive uses. SHA-256 or SHA-512 are the safer defaults today.
- None of these algorithms are suitable for hashing passwords directly — they're fast by design, which makes them cheap to brute-force. Use a dedicated password hash with built-in slowness and salting instead, such as [bcrypt hash](/util/bcrypt_hash/), [argon2 hash](/util/argon2_hash/), or [pbkdf2](/util/pbkdf2/).
- For the still-widely-encountered but even weaker MD5, see [md5](/util/md5/). For newer alternatives with different design goals, see [sha3](/util/sha3/) (SHA-3/Keccak) and [blake](/util/blake/) (BLAKE2/BLAKE3).
- To check a computed digest against a known value automatically instead of comparing by eye, use [checksum verify](/util/checksum_verify/).
