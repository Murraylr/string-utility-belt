---
title: Checksum Verifier Online: Compare Hash Digests
description: Hash text or bytes with MD5, SHA-1, SHA-256, SHA-384, SHA-512, or CRC-32 and check it against an expected digest.
---
## What does this tool check?

This computes a digest of your input and compares it against an expected value you provide, reporting a clear match or mismatch instead of making you eyeball two long hex strings. It's the tool for the everyday "does this file match the checksum the publisher posted" question. It does the same job as running `sha256sum -c` or `md5sum -c` on the command line, but in the browser.

## How it works

1. The input (text as UTF-8, or raw bytes) is hashed with the algorithm you choose.
2. The **expected digest** field is parsed loosely: it accepts a bare hex digest, a `hash  filename` line (as produced by `sha256sum`, `md5sum`, and similar tools), or a BSD-style `MD5 (file) = hash` line. Only the digest itself is pulled out and compared.
3. Hex is compared case-insensitively (an `0x` prefix and `:` or `-` separators are ignored), and the expected value is also accepted as base64 (standard or URL-safe); for CRC-32 specifically, a short form with leading zeros dropped (`f86c29` instead of `00f86c29`) is recognized too, since tools commonly print CRC-32 that way.
4. The computed and expected digests are compared, and the result reports both values plus whether they match. A mismatch is reported, not thrown as an error.

```example
title: a matching SHA-256 digest
params: {"algorithm": "SHA-256", "expected": "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824"}
input: hello
output: {
  "algorithm": "SHA-256",
  "actual": "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
  "expected": "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
  "match": true
}
```

```example
title: a mismatched digest is reported, not thrown
params: {"algorithm": "MD5", "expected": "deadbeef"}
input: hello
output: {
  "algorithm": "MD5",
  "actual": "5d41402abc4b2a76b9719d911017c592",
  "expected": "deadbeef",
  "match": false
}
```

```example
title: a CRC-32 with its leading zeros dropped still matches
params: {"algorithm": "CRC-32", "expected": "f86c29"}
input: v60
output: {
  "algorithm": "CRC-32",
  "actual": "00f86c29",
  "expected": "f86c29",
  "match": true
}
```

## Options

- **algorithm**: MD5, SHA-1, SHA-256 (default), SHA-384, SHA-512, or CRC-32.
- **expected digest**: the value to compare against. Leave it blank to just compute the digest and see `match: false` with an empty expected value, effectively using this as a plain hasher.

## Common uses

- Verifying a downloaded file's integrity against a checksum published on the download page.
- Confirming a value pasted from a `sha256sum`, `md5sum`, or `shasum` output line matches what you computed independently, without manually stripping the filename.
- Quick regression checks that a piece of text or config hasn't drifted from a known-good version.

## Tips and pitfalls

- MD5 and SHA-1 are broken for **collision resistance**: an attacker can deliberately construct two different inputs with the same digest. They're still fine for accidental-corruption checks (matching a publisher's posted checksum) but should not be trusted to prove data hasn't been tampered with by an adversary; prefer SHA-256 or SHA-512 for that. CRC-32 is not cryptographic at all and offers no protection against deliberate tampering.
- A match only proves integrity if the expected digest itself came from a source you trust. An attacker who can swap the file can often swap the checksum posted next to it.
- An expected value with the wrong number of hex digits, or text that isn't a digest at all, is reported as `match: false` with the extracted token shown as `expected`. It does not throw, and it is never treated as a "close enough" prefix match.
- The CRC-32 leading-zero shorthand only applies to CRC-32; other algorithms' expected digests must have the full, correct digit count.
- For non-cryptographic fingerprints with more algorithm choices (CRC-16, Adler-32, FNV-1a, MurmurHash3, xxHash, and more), see [checksum](/util/checksum/). For SHA-3/Keccak or BLAKE2/BLAKE3 digests, see [sha3](/util/sha3/) and [blake](/util/blake/).
