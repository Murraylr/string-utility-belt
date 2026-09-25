---
title: MD5 Hash Generator Online — Free MD5 Checksum
description: Compute the MD5 hash of text or bytes instantly in your browser, and see why MD5 is no longer considered secure.
---
## What is MD5?

MD5 (Message Digest 5) is a 128-bit hash function published in 1992. It was widely used for file checksums, data fingerprinting, and (in its worst-case history) password storage, and it's still common today purely for legacy compatibility — matching an `md5sum` value, checking an old API's signature scheme, or working with a system that was built decades ago and never upgraded. This tool computes it directly with no server round-trip.

## How it works

Text input is encoded as UTF-8 bytes and hashed following the MD5 algorithm defined in RFC 1321, producing a 32-character lowercase hex string. If you feed it raw bytes instead of text (for example, output piped from a previous binary-producing step), it returns the raw 16-byte digest as bytes rather than converting it to hex first — useful when the digest itself needs to flow into another byte-oriented step.

```example
title: hash a plain word
input: hello
output: 5d41402abc4b2a76b9719d911017c592
```

```example
title: unicode text is hashed as UTF-8 bytes
input: café
output: 07117fe4a1ebd544965dc19573183da2
```

```example
title: MD5 of an empty string is a well-known constant
input:
output: d41d8cd98f00b204e9800998ecf8427e
```

## Common uses

- Matching legacy `md5sum` checksums when working with older files, mirrors, or archives that only publish MD5.
- Talking to older APIs or protocols that specify MD5 for a signature or ETag scheme you can't change.
- Quick, non-security fingerprinting of text or config values where speed matters more than collision resistance — for example, a cache key or a "has this changed" comparison against your own previously stored hash.

## Tips and pitfalls

- **MD5 is cryptographically broken.** Practical collision attacks (finding two different inputs with the same MD5 digest) have been known and demonstrated since 2004, and chosen-prefix collisions are now cheap enough to run on ordinary hardware. Never use MD5 where an adversary might benefit from a collision: digital signatures, code signing, certificate fingerprints, or anything security-sensitive.
- MD5 must never be used to store passwords, with or without a salt — it's fast by design, so brute-forcing a database of MD5 password hashes is practical with commodity GPUs. Use [bcrypt hash](/util/bcrypt_hash/) or [argon2 hash](/util/argon2_hash/) instead.
- MD5 is still perfectly fine for **accidental**-corruption checks, like confirming a file transferred without a bit flipping — just not for detecting deliberate tampering. For that distinction and an automatic match/mismatch report, see [checksum verify](/util/checksum_verify/).
- For a modern general-purpose hash with the same "any input, one fixed-length digest" job but real collision resistance, see [hash](/util/hash/) (SHA-256/384/512 — its SHA-1 option is broken for collisions too), [sha3](/util/sha3/) (SHA-3/Keccak), or [blake](/util/blake/) (BLAKE2/BLAKE3).
