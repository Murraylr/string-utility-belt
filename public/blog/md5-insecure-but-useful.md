---
title: "Why MD5 Is Insecure (But Still Useful for Developers)"
description: "MD5 is broken for collisions but still fine for checksums and cache keys. Learn what it's safe for, what it isn't, and which hash to use instead."
date: 2025-09-18
updated: 2026-09-25
slug: md5-insecure-but-useful
tags: [md5, hashing, security, checksums]
---

# Why MD5 Is Insecure (But Still Useful for Developers)

MD5 shows up everywhere in older software, from file checksums to database primary keys, and "MD5 is broken" is repeated so often that it is easy to lose track of what that actually means. It does not mean every use of MD5 is dangerous, and it does not mean MD5 is safe either. This guide explains precisely what is and is not broken, why it matters most for passwords and signatures, and where a fast, unsalted, collision-prone hash is still a perfectly reasonable engineering choice. By the end, you should be able to look at any place your own code uses MD5 today and know immediately whether it needs to change.

## What MD5 actually is

MD5 ("Message Digest 5") was designed by Ronald Rivest in 1991 and formally specified in [RFC 1321](https://www.rfc-editor.org/rfc/rfc1321.html) in 1992. It takes an input of any length and produces a 128-bit digest, almost always written as 32 lowercase hexadecimal characters. The digest of the text `hello` is:

```text
5d41402abc4b2a76b9719d911017c592
```

Like any hash function, MD5 is deterministic (the same input always produces the same digest) and one-way in principle: you are not meant to be able to recover the input from the digest. It was also designed to be fast to compute, a property that becomes important again later in this guide.

## What "broken" actually means

A cryptographic hash is expected to have three properties, and MD5's problems are almost entirely limited to one of them.

**Collision resistance is broken.** A collision is two different inputs that produce the same digest. Xiaoyun Wang and colleagues announced the first practical MD5 collisions in 2004. Marc Stevens, Arjen Lenstra and Benne de Weger followed in 2007 with chosen-prefix collisions, a much more dangerous variant that lets an attacker start from two inputs of their choosing and still force a collision. In December 2008, researchers used a chosen-prefix collision to build a rogue certificate authority certificate trusted by ordinary browsers. In 2012, the Flame malware was found using the same technique to forge a Microsoft code-signing certificate, letting it masquerade as legitimate, signed Windows software. Today, ordinary MD5 collisions can be generated in seconds on a laptop.

**Preimage resistance is still practically intact.** A preimage attack works backward: given only a digest, find any input that produces it. The best published theoretical attack, from 2009, costs on the order of 2^123 operations, which is far beyond what is reachable in practice. This is the main reason MD5 is not the security disaster for every use case that "broken" tends to imply: there is no shortcut for turning a digest back into the data behind it. Guessing still works, though. That is exactly how short or predictable inputs such as passwords are recovered, as the next sections show.

Because of the collision problem, [RFC 6151](https://www.rfc-editor.org/rfc/rfc6151.html) (2011) states plainly that MD5 is no longer acceptable where collision resistance is required, such as digital signatures.

## Why MD5 is especially bad for passwords

MD5 was designed to be fast, which is exactly the wrong property for hashing passwords. A modern GPU can compute billions of MD5 digests per second, so an attacker with a stolen table of unsalted MD5 password hashes can simply try every likely password until the digests match. Common passwords do not even need to be brute-forced: precomputed lookup tables already contain the MD5 digests of the most-used passwords, turning a cracking attempt into a simple lookup.

Passwords need the opposite property: a hash that is deliberately slow (and, in Argon2's case, memory-hard), with a unique salt per password, so guessing is expensive even at scale. Use a password hash such as bcrypt, Argon2 or PBKDF2 instead, and let a vetted library handle the comparison rather than rolling your own.

## Where MD5 is still a reasonable choice

The rule that separates safe uses from unsafe ones is simple: MD5 is fine against accidents, not against adversaries. If nobody has a reason to deliberately engineer a collision against your specific data, its collision weakness never comes into play. That covers:

- Detecting accidental corruption, such as a download or a copy that got damaged in transit.
- Cache keys and generating short, stable identifiers for otherwise-identical content.
- Deduplication and bucketing or sharding, where you just need inputs to map consistently to the same digest.
- Compatibility with legacy systems or file formats that already specify MD5 and cannot easily be changed.

## Where MD5 is not acceptable

The moment an attacker can choose, influence, or prepare any of the inputs, MD5's broken collision resistance becomes a real weakness. Avoid it for:

- Digital signatures and certificates, where a forged collision can make two different documents or certificates appear identical.
- Storing passwords, for the speed reasons above.
- Verifying that a file from an untrusted party has not been tampered with, since a motivated attacker can construct a malicious file with the same digest as a legitimate one.
- Anything else where an attacker controls, or can submit, one side of the data being hashed.

In every one of these cases, the cost of switching to a stronger hash is small compared to the cost of a successful attack.

## MD5 use cases at a glance

| Use case | Is MD5 OK? | Better choice |
| --- | --- | --- |
| Detecting accidental corruption (a bad download or copy) | Yes | -- |
| Cache keys, ETags, deduplication | Yes | -- |
| Digital signatures and certificates | No | SHA-256 or SHA-3 |
| Password storage | No | bcrypt or Argon2 |
| Verifying a file from an untrusted source | No | SHA-256 |
| Message authentication with a shared secret | No | HMAC-SHA256 |
| High-speed checksums where inputs aren't attacker-controlled | Yes | BLAKE2 or BLAKE3 also work |

For general-purpose hashing where you want the safety margin without much extra cost, SHA-2 (SHA-256 and up), SHA-3 and BLAKE are all sound modern choices with no known practical collision or preimage attacks.

## What about HMAC-MD5?

HMAC-MD5 wraps MD5 in a construction that combines it with a secret key, and it is not broken in the same way plain MD5 is: HMAC's security does not depend on the collision resistance of its underlying hash the way a bare digest does, so the attacks above do not carry over directly. That said, HMAC-MD5 is not recommended for new designs simply because there is no reason to keep using MD5 anywhere it can be avoided. Use HMAC with SHA-256 instead for any new message authentication code.

## Try it yourself

You can compute and compare digests directly in your browser with the site's [MD5](/util/md5/) tool, and reach for [SHA-2](/util/hash/), [SHA-3](/util/sha3/), [BLAKE](/util/blake/), [HMAC](/util/hmac/), [bcrypt](/util/bcrypt_hash/), [Argon2](/util/argon2_hash/), [PBKDF2](/util/pbkdf2/) or [checksum](/util/checksum/) for anything MD5 is no longer the right fit for. Everything runs locally in your browser, so the data you hash is never uploaded anywhere. When a use case could reasonably go either way, default to the safer option in the table above: the extra computation is rarely the bottleneck in a real application.
