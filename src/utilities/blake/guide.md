---
title: BLAKE2 & BLAKE3 Hash Generator Online — Keyed
description: Compute a BLAKE2b, BLAKE2s, or BLAKE3 digest, optionally keyed as a built-in MAC, output as hex or base64, in your browser.
---
## What are BLAKE2 and BLAKE3?

BLAKE2 and BLAKE3 are modern cryptographic hash functions designed to be significantly faster than SHA-2 and SHA-3 in software while keeping strong security guarantees. BLAKE2 (2012) comes in two variants — **BLAKE2b**, tuned for 64-bit platforms, and **BLAKE2s**, tuned for smaller or 32-bit ones — and is derived from BLAKE, a finalist in the SHA-3 competition. **BLAKE3** (2020) is a newer, even faster redesign built around a Merkle tree, which is why it scales especially well on large input.

A distinctive feature of both families, and one this tool exposes directly, is **built-in keyed hashing**: pass a key and you get a message authentication code (MAC) without needing a separate HMAC construction.

## How it works

Text is hashed as UTF-8 bytes (raw bytes pass through unchanged), and the digest is returned as hex or base64.

```example
title: BLAKE2b-256 of "hello" (the default algorithm)
input: hello
output: 324dcf027dd4a30a932c441f365a25e86b173defa4b8e58948253471b81b72cf
```

```example
title: BLAKE2s-128, the smaller/32-bit-tuned variant
params: {"algorithm": "BLAKE2s-128"}
input: abc
output: aa4938119b1dc7b87cbad0ffd200d0ae
```

Supplying a **key** turns the hash into a MAC — the same input produces a completely different digest depending on the key, and without the key, nobody can reproduce or verify the output:

```example
title: BLAKE3-256, keyed with an exact 32-byte key
params: {"algorithm": "BLAKE3-256", "key": "abcdefghijklmnopqrstuvwxyz012345"}
input: hello
output: ebfd8681bea377568769ba0620b040a6809a6c4cc18bb64116498fb1b392ea75
```

```example
title: base64 output instead of hex
params: {"algorithm": "BLAKE2b-256", "output": "base64"}
input: abc
output: vd2BPGNCOXIxce8/7phXm5SWTjuxyz5CcmLIwGjVIxk=
```

```example
title: empty input
input:
output:
```

## Options

- **algorithm** — `BLAKE2b-256`, `BLAKE2b-512`, `BLAKE2s-128`, `BLAKE2s-256`, or `BLAKE3-256`.
- **key (optional)** — leave blank for a plain, unkeyed hash. The key is read as UTF-8 bytes, and its length is measured in bytes, not characters — a key with accented letters or emoji can be longer in bytes than it looks. BLAKE2b accepts up to 64 key bytes, BLAKE2s up to 32, and BLAKE3 requires **exactly** 32 — anything else throws a clear error naming the limit.
- **output** — `hex` (default) or `base64`.

## Common uses

- Fast file and data integrity checks where BLAKE2/BLAKE3's software speed advantage over SHA-2 matters, such as hashing large files. The command-line equivalents are `b3sum` (BLAKE3, 256-bit by default) and GNU coreutils' `b2sum` (BLAKE2b, 512-bit by default, so pick `BLAKE2b-512` to match it).
- Keyed hashing (MAC) for verifying that a message came from someone holding a shared secret, as a lighter-weight alternative to constructing an [hmac](/util/hmac/) around a separate hash function.
- Content-addressed storage and deduplication systems that specifically use BLAKE2 or BLAKE3 as their hash, as some backup and storage tools do.

## Tips and pitfalls

- A BLAKE3-256 key must be **exactly** 32 bytes — 31 or 33 is rejected, unlike BLAKE2b/BLAKE2s, which merely cap the key length. The key field is text, not hex: a 64-character hex string (such as a SHA-256 digest from [hash](/util/hash/)) counts as 64 bytes and is rejected, so a BLAKE3 key here is 32 bytes of UTF-8 text, for example 32 ASCII characters.
- Keyed BLAKE2/BLAKE3 is a MAC, but it doesn't come with expiry, sequence numbers, or the other pieces of a full authentication protocol — pair it with your own message design (nonces, timestamps) rather than assuming keying alone stops replay attacks.
- None of these algorithms include salting or slow iteration for you, so like SHA-2 and SHA-3, they are not appropriate for hashing passwords on their own — use [bcrypt hash](/util/bcrypt_hash/), [argon2 hash](/util/argon2_hash/), or [pbkdf2](/util/pbkdf2/) instead.
- Empty input produces an empty result, not the digest of the empty message.
- For the NIST-standardized SHA-2 and SHA-3 families, see [hash](/util/hash/) and [sha3](/util/sha3/).
