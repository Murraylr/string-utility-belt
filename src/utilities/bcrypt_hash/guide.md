---
title: Bcrypt Hash Generator — Hash Passwords Online
description: Generate a bcrypt password hash online with a chosen cost factor and salt. See exactly how the $2a$ hash string is built, with worked examples.
---
## What is bcrypt?

Bcrypt is a password-hashing function built around the Blowfish cipher, designed in 1999 specifically to be slow and to stay slow even as hardware gets faster. Instead of taking a plain iteration count, it takes a **cost factor**: each increment doubles the number of internal rounds, so cost 11 is twice as slow as cost 10. That single tunable knob, plus a salt that travels inside the output string itself, is why bcrypt hashes are still one of the most common ways to store passwords, from OpenBSD's system password file and Apache `.htpasswd` files to countless web application databases.

## How it works

Feeding a password and a salt through bcrypt produces one self-contained string that holds the algorithm version, the cost, the salt, and the hash together:

```example
title: hashing with a fixed salt (reproducible for the example)
input: hunter2
params: {"cost": 4, "salt": "000102030405060708090a0b0c0d0e0f"}
output: $2a$04$..CA.uOD/eaGAOmJB.yMBurkTM.teJW4P/NXJXOT49X8IHvXALk4i
```

Reading the string left to right: `2a` is the bcrypt format version, `04` is the cost factor, and the next 22 characters are the salt written in bcrypt's own base64-like alphabet (`./A-Za-z0-9` — note this is **not** standard Base64, which starts with `A-Za-z0-9+/`). The final 31 characters are the hash itself. Because the salt rides along in the output, checking a password later only means re-running bcrypt with that same salt and cost and comparing the result — see [bcrypt verify](/util/bcrypt_verify/) for that half of the workflow.

Raising the cost factor changes the whole 31-character digest, even with the same password and salt (the salt characters stay the same), because it changes how many rounds of key setup bcrypt runs before producing output:

```example
title: raising the cost factor changes the hash
input: hunter2
params: {"cost": 5, "salt": "000102030405060708090a0b0c0d0e0f"}
output: $2a$05$..CA.uOD/eaGAOmJB.yMBug2q2CK1LPMlnGrOl3jjoYwsl5.AMMFW
```

Non-ASCII passwords are hashed by their UTF-8 bytes:

```example
title: hashing a password with Cyrillic and emoji characters
input: пароль🔐
params: {"cost": 4, "salt": "000102030405060708090a0b0c0d0e0f"}
output: $2a$04$..CA.uOD/eaGAOmJB.yMBu18hWFFv0ibHu447OSm87zIEO/NAXPU6
```

An empty password returns an empty string rather than hashing an empty value:

```example
title: empty input produces no hash
input:
output:
```

## Options

- **cost factor (4–31)** — controls how many rounds bcrypt runs, doubling with each step up; the default is `10`. Pick the highest value your server can comfortably afford to spend computing a hash on every login attempt.
- **salt (blank = random)** — leave it blank for 16 cryptographically random bytes on every run. Otherwise you can supply: 32 hex characters (optionally prefixed with `0x`; whitespace is ignored, but other separators such as `-` or `:` are not), a 22-character bcrypt-alphabet salt copied out of an existing hash, a whole `$2a$…`/`$2b$…`/`$2y$…` hash or bare settings string (its embedded salt is extracted automatically — the cost in the pasted string does **not** override the cost you set), or exactly 16 bytes of plain text.

## Two things bcrypt does differently from most hashes

- **It only looks at the first 72 bytes of the password.** Many bcrypt implementations silently truncate anything past that point, so `"a".repeat(80)` and `"a".repeat(72)` would hash identically elsewhere. This tool refuses passwords over 72 UTF-8 bytes outright instead of silently discarding the rest — note that's *bytes*, not characters, so 72 emoji is already well past the limit.
- **It is C-string based and stops at the first NUL byte (`\0`).** A password containing an embedded NUL would otherwise hash as if everything after that byte did not exist, letting `"abc\0anything"` verify as `"abc"`. This tool refuses to hash a password containing a NUL rather than silently truncating it.

## Common uses

- Hashing user passwords for login systems (the classic `htpasswd`/Apache Basic Auth use case, and the origin of this utility's alias).
- Verifying a login attempt against a stored hash with [bcrypt verify](/util/bcrypt_verify/).
- Comparing bcrypt's cost model against [argon2 hash](/util/argon2_hash/) (memory-hard, generally the modern first choice) or [pbkdf2](/util/pbkdf2/) (iteration-based, FIPS-recognized) when deciding how to store credentials.

## Tips and pitfalls

- Never store passwords with a general-purpose hash like SHA-256 or MD5 (see [hash](/util/hash/)) — those are designed to be fast, which is exactly the wrong property for password storage.
- Modern bcrypt hashes start with `$2a$`, `$2b$`, or `$2y$` (`$2x$` marks hashes from an old, buggy implementation). This tool always emits `$2a$`, which mainstream bcrypt libraries accept; because passwords here are capped at 72 bytes, the `$2b$` or `$2y$` hash of the same input would differ only in that prefix.
- A fixed salt like the ones in the examples above is only useful for producing reproducible documentation — always leave the salt field blank in real use so every hash gets its own random salt.
- If you need a strong password to hash in the first place, generate one with [password generator](/util/password_generator/).
