---
title: JWT Signature Verifier Online: Check HS256
description: Verify a JWT's HMAC signature (HS256, HS384, HS512) against your secret, and check whether it has expired, without a server.
---
## What does JWT verification mean?

A JSON Web Token (JWT) is three base64url-encoded parts joined by dots: a header, a payload, and a signature, as in `header.payload.signature`. Anyone can decode the header and payload without any secret at all, which is what [jwt decode](/util/jwt_decode/) does; that only tells you what a token *claims*, not whether it's genuine. Verification is different: for an HMAC-signed token it recomputes the signature over the header and payload using the shared secret key and checks that it matches the one embedded in the token. Only someone who holds the secret could have produced a token whose signature checks out, which is what makes a JWT trustworthy for authentication and authorization.

## How it works

This tool only verifies **HMAC-signed** tokens: `HS256`, `HS384`, and `HS512`, which use SHA-256, SHA-384, and SHA-512 respectively as the underlying hash. It reads the algorithm from the token's own header, recomputes an HMAC over `header.payload` with your secret, and compares it to the signature in the token using WebCrypto. It also checks the standard `exp` (expiry) and `nbf` (not valid before) claims when present, per RFC 7519, against your device's clock with no clock-skew leeway. If the signature is valid but the payload isn't decodable JSON, the token is reported as valid with a note that `exp`/`nbf` could not be checked.

```example
title: valid, unexpired token
params: {"secret": "my-secret", "secretFormat": "text", "checkExpiry": true}
input: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyMTIzIiwiZXhwIjo0MTAyNDQ0ODAwfQ.aJxvu2C4BASwRVqfRlA1g4Pn0ll8kiRebvH4wo396aQ
output: {
  "valid": true,
  "algorithm": "HS256",
  "reason": "signature is valid",
  "expired": false
}
```

```example
title: an expired token is rejected even with the right secret
params: {"secret": "my-secret", "secretFormat": "text", "checkExpiry": true}
input: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyMTIzIiwiZXhwIjoxMDAwMDAwMDAwfQ.08xF_XOKxxvPpUuk4mhVMMMUQ8n2oQxN5OevXj7lgVY
output: {
  "valid": false,
  "algorithm": "HS256",
  "reason": "token expired at 2001-09-09T01:46:40.000Z",
  "expired": true
}
```

```example
title: turning checkExpiry off still reports the token as expired
params: {"secret": "my-secret", "secretFormat": "text", "checkExpiry": false}
input: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyMTIzIiwiZXhwIjoxMDAwMDAwMDAwfQ.08xF_XOKxxvPpUuk4mhVMMMUQ8n2oQxN5OevXj7lgVY
output: {
  "valid": true,
  "algorithm": "HS256",
  "reason": "signature is valid (token is expired, but expiry checking is off)",
  "expired": true
}
```

```example
title: the wrong secret fails, even for an otherwise well-formed token
params: {"secret": "wrong-secret", "secretFormat": "text", "checkExpiry": true}
input: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyMTIzIiwiZXhwIjo0MTAyNDQ0ODAwfQ.aJxvu2C4BASwRVqfRlA1g4Pn0ll8kiRebvH4wo396aQ
output: {
  "valid": false,
  "algorithm": "HS256",
  "reason": "signature does not match the secret",
  "expired": false
}
```

```example
title: text that isn't a JWT at all is reported, not thrown
params: {"secret": "k"}
input: hello world
output: {
  "valid": false,
  "algorithm": null,
  "reason": "not a jwt — expected 3 dot-separated parts, got 1",
  "expired": false
}
```

## Options

- **secret**: the shared HMAC secret. Required; a blank secret throws an error rather than silently failing every check.
- **secret format**: `text` (default) treats the secret as a raw UTF-8 string, the most common case for hand-configured secrets. `base64url` and `hex` decode the secret to bytes first, for secrets generated as random key material. The `base64url` reader also tolerates the standard `+`/`/` alphabet.
- **check exp / nbf**: on by default. When on, an expired (`exp` in the past) or not-yet-valid (`nbf` in the future) token is reported as invalid even if its signature checks out. Turn it off to see the signature result on its own, independent of timing.

## Common uses

- Debugging "why is my API rejecting this token" by checking the signature and expiry against the secret your server actually uses.
- Confirming a token-issuing service is signing with the secret and algorithm you expect before wiring up a client.
- Learning how JWT verification differs from JWT decoding, and why a JWT that "looks fine" when decoded can still be forged or expired.

## Tips and pitfalls

- **Never trust a decoded-but-unverified JWT.** Anyone can craft a token with any header and payload they like; only a successful signature check (this tool) proves it was issued by whoever holds the secret. [JWT decode](/util/jwt_decode/) alone tells you nothing about authenticity.
- Tokens signed with asymmetric algorithms (`RS256`, `ES256`, `PS256`, and similar) can't be checked here. Verifying those needs the issuer's public key, not a shared secret, and this tool reports them as unsupported rather than guessing.
- A token whose header declares `"alg": "none"` is unsigned by design; this tool reports it as such instead of treating it as valid, closing a well-known JWT vulnerability where a forged token claims no signature is needed.
- This tool checks `exp` and `nbf` only. It does not check `aud`, `iss`, or any other claim. Your application still needs to validate that the token was issued for the right audience and issuer.
- The secret and format you enter here need to be the encoding of the exact same bytes the token was signed with; a text secret typed with a stray trailing space is a different key from one without it. Compare with [hmac](/util/hmac/) if you want to compute a raw HMAC yourself.
