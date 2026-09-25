---
title: HMAC Generator Online — SHA-256 Signature Tool
description: Compute an HMAC (SHA-1, SHA-256, SHA-384 or SHA-512) online for webhook and API signatures, with text, hex or base64 keys and RFC test vectors.
---
## What is HMAC?

HMAC (Hash-based Message Authentication Code, [RFC 2104](https://datatracker.ietf.org/doc/html/rfc2104)) combines a secret key with a hash function so that only someone who holds the key can produce — or verify — a valid signature over a message. A plain hash like SHA-256 proves a message was not altered only if the hash itself was delivered over a trusted channel; HMAC instead lets two parties who share a secret confirm both integrity and authenticity, which is exactly what webhook signatures and signed API requests need. Simply concatenating `hash(key + message)` looks similar but is vulnerable to length-extension attacks on some hash families — HMAC's specific double-hashing construction avoids that, which is why it is the standard rather than the shortcut.

## How it works

Give this tool a message as the input, a secret key, and it signs the message with the chosen algorithm:

```example
title: text key, hex output
input: hello
params: {"algorithm": "SHA-256", "key": "secret", "keyFormat": "text", "output": "hex"}
output: 88aab3ede8d3adf94d26ab90d3bafd4a2083070c3bcce9c014ee04a443847c0b
```

The same key can be supplied as hex or base64 instead of literal text — useful when a system hands you a key as one of those encodings rather than a passphrase:

```example
title: hex key, base64 output
input: hello
params: {"algorithm": "SHA-256", "key": "deadbeef", "keyFormat": "hex", "output": "base64"}
output: KXpxXaiiuT8of9Xm59R2S8Pomd91VtWIiaT5hmVsgAk=
```

A base64url output (`-`/`_` instead of `+`/`/`, no padding) is available directly — it is the encoding JWT signatures use. Webhook providers more often send hex (as GitHub and Stripe do) or standard base64, so match whatever the provider's documentation specifies:

```example
title: base64url output
input: The quick brown fox jumps over the lazy dog
params: {"algorithm": "SHA-256", "key": "key", "output": "base64url"}
output: 97yD9DBThCSxMpjmqm-xQ-9NWaFJRhdZl0edvC0aPNg
```

This implementation is checked against the official [RFC 4231](https://datatracker.ietf.org/doc/html/rfc4231) HMAC-SHA-256 test vectors, including test case 1 (a 20-byte key of `0x0b` bytes):

```example
title: RFC 4231 test case 1
input: Hi There
params: {"algorithm": "SHA-256", "key": "0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b", "keyFormat": "hex"}
output: b0344c61d8db38535ca8afceaf0bf12b881dc200c9833da726e9376c2e32cff7
```

## Options

- **algorithm** — `SHA-1`, `SHA-256` (default), `SHA-384`, or `SHA-512`. SHA-1 is included for interoperability with older systems but should not be chosen for new designs; SHA-256 is the common default for webhook signatures (GitHub, Stripe and similar providers use HMAC-SHA-256).
- **key** — the shared secret.
- **key format** — how to interpret the key field: `text` (UTF-8, the default), `hex` (an optional `0x` prefix and whitespace, `:` or `-` separators are ignored), or `base64` (the URL-safe alphabet with `-`/`_` and missing padding is also accepted). A key is required; leaving it blank throws rather than silently signing with an empty key.
- **output** — `hex` (default), `base64`, or `base64url`.

## Common uses

- Verifying inbound webhooks by recomputing the HMAC over the raw request body with the shared secret and comparing it to the signature header the provider sent.
- Signing outgoing API requests where the server checks the signature against a key it already knows, without transmitting the key itself.
- Deriving the signature portion of a `HS256`-signed JWT by hand, to understand or debug what [jwt verify](/util/jwt_verify/) checks automatically.

## Tips and pitfalls

- HMAC keys longer than the algorithm's internal block size are hashed down to a fixed size first rather than truncated or zero-padded — this tool follows the same rule the HMAC specification and every standard library use, so long keys still verify correctly against other implementations.
- HMAC is symmetric: whoever can verify a signature can also forge one, because verifying requires knowing the same key used to sign. It is not a substitute for asymmetric signing schemes where verifiers should not be able to produce new valid signatures.
- Comparing two HMAC values with a plain `===` string comparison in application code can leak timing information; production signature checks should use a constant-time comparison. This tool only generates the value; it does not compare anything.
- To hash a message without a key, use [hash](/util/hash/) instead — HMAC without a real secret provides no authentication guarantee.
- For turning a low-entropy password into a cryptographic key (rather than signing a message), see [pbkdf2](/util/pbkdf2/), which also builds on HMAC internally.
