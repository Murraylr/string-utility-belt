---
title: Bcrypt Verify Online — Check a Password Hash
description: Check whether a password matches a bcrypt hash online, and see the hash's variant, cost factor and salt decoded from the $2a$ string.
---
## What does bcrypt verify do?

[Bcrypt hash](/util/bcrypt_hash/) turns a password into a self-contained string carrying its salt and cost alongside the digest. Checking a login attempt later does not involve "decrypting" that string — bcrypt is one-way — it means re-running bcrypt on the candidate password with the exact salt and cost pulled out of the stored hash, then comparing the two digests. This tool does that comparison for you: give it a candidate password as the input and an existing bcrypt hash as a parameter, and it reports whether they match, plus the algorithm variant, cost factor, and salt it decoded from the hash string.

## How it works

A bcrypt hash is 60 characters: a prefix such as `$2b$`, a two-digit cost and a `$`, then a 22-character salt and a 31-character digest. This tool parses that shape first, then verifies:

```example
title: a matching password
input: hunter2
params: {"hash": "$2a$04$..CA.uOD/eaGAOmJB.yMBurkTM.teJW4P/NXJXOT49X8IHvXALk4i"}
output: {
  "match": true,
  "algorithm": "2a",
  "cost": 4,
  "salt": "..CA.uOD/eaGAOmJB.yMBu",
  "reason": ""
}
```

The result is JSON so a pipeline further down the chain can branch on `match` directly. When the password is wrong, `match` is `false` and `reason` explains why:

```example
title: a password that does not match
input: not the password
params: {"hash": "$2a$04$..CA.uOD/eaGAOmJB.yMBuaOWmnNUFfwORoH..MfuhEhaBiFsYEfG"}
output: {
  "match": false,
  "algorithm": "2a",
  "cost": 4,
  "salt": "..CA.uOD/eaGAOmJB.yMBu",
  "reason": "password does not match this hash"
}
```

If you have not pasted in a hash yet, the tool reports that plainly instead of throwing an error, so a pipeline still produces valid JSON while you are setting things up:

```example
title: no hash configured yet
input: hunter2
output: {
  "match": false,
  "algorithm": "",
  "cost": 0,
  "salt": "",
  "reason": "no bcrypt hash supplied"
}
```

An empty candidate password is handled the same way, without throwing:

```example
title: an empty password to check
input:
params: {"hash": "$2a$04$..CA.uOD/eaGAOmJB.yMBuaOWmnNUFfwORoH..MfuhEhaBiFsYEfG"}
output: {
  "match": false,
  "algorithm": "2a",
  "cost": 4,
  "salt": "..CA.uOD/eaGAOmJB.yMBu",
  "reason": "input (the password) is empty"
}
```

## Options

- **bcrypt hash** — the full 60-character hash to check against, in the shape `$2a$10$…`, `$2b$10$…`, or `$2y$10$…`. Surrounding whitespace is trimmed automatically, so pasting a hash with a stray newline still works.

## What gets validated

Beyond the match itself, this tool checks the hash string is well-formed before attempting anything:

- It must be exactly 60 characters in the `$2a$cc$<22-char salt><31-char digest>` shape (prefix `$2a$`, `$2b$`, `$2x$` or `$2y$`), using bcrypt's own base64-like alphabet — anything shorter, longer, or malformed throws a clear error rather than silently reporting no match.
- The embedded cost must be between 4 and 31; an out-of-range cost (for example, a corrupted or hand-edited hash) throws instead of being quietly accepted.
- `$2x$` hashes — the prefix that marks hashes from the old, buggy `crypt_blowfish` implementation that mishandled 8-bit characters — are refused outright, because verifying them correctly would require reproducing that bug rather than standard bcrypt.
- A candidate password containing a NUL (`\0`) byte is refused rather than checked, because bcrypt is C-string based and stops at the first NUL: silently checking only the part before it could report a match against a password the user never actually typed.
- A candidate password longer than 72 UTF-8 bytes is refused, matching the same limit [bcrypt hash](/util/bcrypt_hash/) enforces when creating a hash in the first place.

## Common uses

- Checking a login form's submitted password against the bcrypt hash stored for that user.
- Verifying that a bcrypt hash produced elsewhere (a database export, a `.htpasswd` line, another language's bcrypt library) has the variant, cost, and salt you expect.
- Confirming that [bcrypt hash](/util/bcrypt_hash/) and this tool agree on a password before wiring either into an application.

## Tips and pitfalls

- For passwords of up to 72 bytes, `$2a$`, `$2b$`, and `$2y$` hashes are computed the same way — this tool checks all three identically and simply reports back whichever prefix the hash used.
- A `match: false` result does not distinguish "wrong password" from "right password, corrupted hash" — if every password fails against a hash you believe is correct, check that no characters were altered in copying. (A truncated hash, or one still carrying a `user:` prefix from a `.htpasswd` line, throws a format error instead.)
- This tool never modifies or re-hashes the password; it only compares. To create a new hash, use [bcrypt hash](/util/bcrypt_hash/).
