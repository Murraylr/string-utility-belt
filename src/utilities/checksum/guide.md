---
title: CRC32 & Checksum Calculator Online: Hash Text
description: Compute non-cryptographic checksums like CRC-32, CRC-16, Adler-32, FNV-1a, MurmurHash3, and xxHash from text or bytes.
---
## What is a checksum, and how is it different from a hash?

A checksum is a short fingerprint computed from data, designed to catch accidental corruption: a flipped bit from a bad network link, a truncated file, a typo in a copy-pasted value. Algorithms like CRC-32, Adler-32, and the others here are fast and good at that job, but they are **not cryptographic**: it's computationally easy to construct different inputs that produce the same checksum on purpose. For that kind of guarantee (resisting a deliberate attacker, not just bad luck), use [hash](/util/hash/), [sha3](/util/sha3/), or [blake](/util/blake/) instead.

## How it works

Pick an algorithm and this tool hashes your text (as UTF-8 bytes) or raw bytes with it, showing the result as hex or decimal.

```example
title: CRC-32 of "hello" (the default algorithm)
input: hello
output: 3610a686
```

```example
title: the same CRC-32 digest, shown as a decimal number
params: {"output": "decimal"}
input: hello
output: 907060870
```

```example
title: FNV-1a-32, a different algorithm
params: {"algorithm": "FNV-1a-32"}
input: hello
output: 4f9f2cab
```

CRC-32, CRC-32C, and Adler-32 support a **running seed**: hashing part of a stream, then continuing from where you left off, gives the same result as hashing it all at once. Every other algorithm just uses the seed as its own starting parameter instead:

```example
title: seeding xxHash-64 changes the digest
params: {"algorithm": "xxHash-64", "seed": 42}
input: hello
output: c3629e6318d53932
```

```example
title: empty input
input:
output:
```

## Options

- **algorithm**: CRC-32, CRC-32C, CRC-16-CCITT, CRC-16-MODBUS, Adler-32, FNV-1a-32, FNV-1a-64, MurmurHash3-32, xxHash-32, xxHash-64, Java-hashCode, djb2, or sdbm. Defaults to CRC-32, the most widely recognized (used in zip files, PNG, and Ethernet frame checks).
- **output**: `hex` (default) or `decimal`. Java-hashCode's decimal form is signed, matching what `String.hashCode()` returns in Java; every other algorithm's decimal form is unsigned.
- **seed**: `0` (default) means "the algorithm's standard starting value." For CRC-32, CRC-32C, and Adler-32, a non-zero seed is treated as a previous running result, letting you resume a checksum across chunks of a larger stream. For the others (CRC-16, FNV, MurmurHash3, xxHash, Java-hashCode, djb2, sdbm), a non-zero seed simply changes the starting value, producing a different but still deterministic digest for the same input.

## Common uses

- Verifying a download or file transfer completed without corruption, especially formats that embed a CRC-32 already (ZIP, PNG, gzip).
- Fast, low-collision hash table keys and cache keys (FNV-1a, MurmurHash3, xxHash, djb2) where cryptographic strength isn't needed and speed matters.
- Reproducing `java.lang.String.hashCode()` values in a non-Java context, for interop with Java-based systems that key on that hash.
- Checking two large files or byte streams for equality quickly, before falling back to a full byte-for-byte comparison if the checksums match.

## Tips and pitfalls

- None of these algorithms resist a deliberate attacker: given a target checksum, it's practical to construct different data that produces it. Never rely on a checksum to show that data hasn't been *tampered with* by someone who wants to fool you. Compare a SHA-256 digest from a trusted source with [checksum verify](/util/checksum_verify/), or use [hmac](/util/hmac/) when you share a secret key. For password storage, neither these nor fast cryptographic hashes are suitable; use [bcrypt hash](/util/bcrypt_hash/) or [argon2 hash](/util/argon2_hash/).
- CRC-32 is usually shown as unsigned hex, as it is here; some other tools print it as a signed decimal integer, which looks completely different for the same bytes even though the underlying bits match.
- Text input is hashed as its UTF-8 bytes for every algorithm except Java-hashCode, which is defined over UTF-16 code units. Byte input to Java-hashCode is first decoded as UTF-8, so bytes in another encoding (or invalid UTF-8) won't reproduce Java's value for the original string.
- For comparing a computed digest against a known-good one automatically, see [checksum verify](/util/checksum_verify/), which handles common formats like `hash  filename` lines.
