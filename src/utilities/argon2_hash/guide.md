---
title: Argon2 Hash Generator — Hash Passwords Online
description: Hash passwords with Argon2 (argon2id, argon2i, argon2d) online. Tune iterations, memory and parallelism, and see the PHC output explained.
---
## What is Argon2?

Argon2 is a password-hashing function that won the 2015 Password Hashing Competition, and its argon2id variant is the first choice in OWASP's Password Storage Cheat Sheet. Unlike a plain hash such as SHA-256, Argon2 is deliberately slow and, more importantly, **memory-hard**: checking one password candidate requires allocating a configurable block of RAM, not just CPU cycles. That makes large-scale cracking on GPUs and ASICs — which have cheap compute but comparatively little fast memory per core — far more expensive than it is against SHA-256, PBKDF2, or even bcrypt. This tool hashes the input as a password with a WebAssembly Argon2 implementation and returns the standard PHC-formatted hash string.

## How it works

Argon2 combines the password, a salt, and three cost parameters into one hash, and it encodes all of that into a single self-describing string. Hashing `hunter2` with a deliberately small cost (so the example runs instantly) and a fixed salt produces:

```example
title: argon2id with a small work factor (fixed salt, reproducible)
input: hunter2
params: {"iterations": 2, "memoryKiB": 8, "parallelism": 1, "salt": "0000000000000000"}
output: $argon2id$v=19$m=8,t=2,p=1$AAAAAAAAAAA$kJIgd5fDoU8M8s/bTbAR8Pbft1SJMQmQGBZjeJT0PT4
```

Reading the string left to right: `argon2id` is the variant, `v=19` is the Argon2 version, `m=8,t=2,p=1` are the memory (KiB), iteration and parallelism costs, and the last two `$`-separated fields are the base64-encoded salt and the base64-encoded hash itself. Verifying a password later means re-running Argon2 with the same salt and cost parameters (which are right there in the string) and comparing the resulting hash.

### The three variants

- **argon2id** (the default, and the one to pick unless you have a specific reason not to) mixes the data-dependent and data-independent approaches, resisting both GPU cracking and side-channel attacks on the memory access pattern.
- **argon2i** only uses data-independent memory access, so its memory-access pattern reveals nothing about the password through cache-timing side channels — useful when an attacker may be able to observe the hashing machine, such as on shared hardware.
- **argon2d** only uses data-dependent access. It is the most resistant to GPU/ASIC cracking but the access pattern depends on the password itself, so it is best reserved for contexts without a side-channel attacker, such as cryptocurrency proof-of-work.

The variant changes how memory blocks are chosen (and is itself mixed into the hash), so the same salt and cost parameters produce a different hash under each one:

```example
title: the same password and salt under a different variant
input: correct horse battery staple
params: {"variant": "argon2i", "iterations": 2, "memoryKiB": 64, "parallelism": 1, "salt": "saltysaltysalty!"}
output: $argon2i$v=19$m=64,t=2,p=1$c2FsdHlzYWx0eXNhbHR5IQ$vsKl9ahZWYLPEa+fwk7dIUtCD+/QjkZok71IFcLmiJA
```

### Non-ASCII passwords

The password is hashed by its UTF-8 bytes, so non-Latin letters and emoji are handled correctly and are not equivalent to any ASCII-only string that merely looks similar:

```example
title: a password with Cyrillic and emoji characters
input: пароль🔐
params: {"iterations": 2, "memoryKiB": 64, "parallelism": 1, "salt": "saltysaltysalty!"}
output: $argon2id$v=19$m=64,t=2,p=1$c2FsdHlzYWx0eXNhbHR5IQ$jBVxfGzoCjQBcq+4WINk1aMHu4MQCb1vEhkB/bDoDnE
```

An empty password input returns an empty string rather than hashing an empty password:

```example
title: empty input produces no hash
input:
output:
```

## Options

- **variant** — `argon2id` (default), `argon2i`, or `argon2d`, as described above.
- **iterations (t)** — how many passes to make over memory; default `3`, minimum `1`. Raising it linearly increases the time cost.
- **memory (KiB)** — how much RAM one hash attempt must allocate; default `4096` KiB (4 MiB). Real deployments commonly use tens of megabytes or more. Argon2 requires at least 8 KiB per lane of parallelism, so the minimum legal value scales with the parallelism setting.
- **parallelism (p)** — how many lanes run concurrently; default `1`.
- **hash length (bytes)** — the size of the derived hash, default `32` bytes, minimum `4`.
- **salt (blank = random)** — leave it empty for 16 cryptographically random bytes on every run. Otherwise, give it an even-length hex string of at least 16 characters (8 bytes) to use those exact bytes, or plain text that is at least 8 bytes once UTF-8 encoded. Note that text made only of an even number (16 or more) of hex digits, such as `deadbeefdeadbeef`, is read as hex, not as text. Argon2 requires a salt of at least 8 bytes; a shorter one is rejected rather than silently padded.

This tool also caps iterations at 1000, parallelism at 1024, memory at 1 GiB, and hash length at 1024 bytes. Those ceilings are far above anything a real deployment would tune to — they exist only so that a stray extra digit typed into a field cannot ask the browser tab to allocate many gigabytes of memory or grind for minutes on every keystroke, since the pipeline recomputes the output as you type.

## Common uses

- Storing user passwords for a web application's login system, alongside a per-user random salt.
- Experimenting with Argon2 as a key-derivation function for a passphrase — the derived bytes are the last, base64-encoded field of the output string.
- Comparing Argon2's cost and output shape against [bcrypt hash](/util/bcrypt_hash/) or [pbkdf2](/util/pbkdf2/) when choosing a password-hashing scheme.

## Tips and pitfalls

- Argon2 is not reversible and this tool does not verify passwords against an existing hash. To check a match by hand, copy the variant, cost parameters and hash length from an existing PHC string — but the salt field there is base64, and this tool reads the salt box as hex or UTF-8 text, so convert the salt's bytes to hex first; pasting the base64 text as-is gives a different hash.
- A higher memory cost is usually a stronger lever against GPU attackers than more iterations, because it directly limits how many candidate hashes fit in a cracking rig's fast memory at once.
- If you need a random, unpredictable salt for production use, leave the salt field blank; the fixed salts in the examples above exist only so the documented output is reproducible.
- Where a NIST-approved password-based KDF is required, [pbkdf2](/util/pbkdf2/) (built on [hmac](/util/hmac/)) is the traditional choice, though it lacks Argon2's memory-hardness. A single HMAC on its own is not a password KDF.
