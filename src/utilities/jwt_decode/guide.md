---
title: JWT Decoder Online: Decode JSON Web Tokens
description: Decode a JWT's header, payload and signature online with readable expiry, issued-at and not-before dates. No signature check: decode only.
---
## What is a JWT?

A JSON Web Token ([RFC 7519](https://www.rfc-editor.org/rfc/rfc7519)) is a compact way to carry a signed set of claims between a server and a client: who a user is, what they can do, when the token expires. In its common compact form it is three base64url-encoded segments separated by dots: `header.payload.signature`. The header and payload are just JSON; only the signature actually proves the token was not tampered with, and this tool does not check it. It decodes the header and payload so you can read what a token contains during debugging. Encrypted tokens (JWE, which have five segments) cannot be read without the key and are rejected.

## How it works

Paste a token in and this tool splits it on its dots, decodes the header and payload from base64url, and parses each as JSON.

```example
title: full decode
input: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c
output:
{
  "header": {
    "alg": "HS256",
    "typ": "JWT"
  },
  "payload": {
    "sub": "1234567890",
    "name": "John Doe",
    "iat": 1516239022
  },
  "signature": "SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c",
  "expiresAt": null,
  "issuedAt": "2018-01-18T01:30:22.000Z",
  "notBefore": null,
  "isExpired": false
}
```

Alongside the raw `header` and `payload` objects, this tool converts the standard time-based claims (`exp`, `iat` and `nbf`) from their raw Unix-seconds form into readable ISO 8601 timestamps (`expiresAt`, `issuedAt`, `notBefore`), and computes `isExpired` by comparing `exp` against the current time. A token missing one of those claims simply gets `null` for the matching field, and `isExpired` is `false` whenever there is no `exp` claim to check.

### Narrowing the result

Set **part** to `header` or `payload` to get just that segment as a plain object, without the signature or the computed date fields.

```example
title: just the payload
params: {"part": "payload"}
input: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c
output:
{
  "sub": "1234567890",
  "name": "John Doe",
  "iat": 1516239022
}
```

A `Bearer ` prefix and surrounding whitespace (as you would copy straight out of an `Authorization` header) are stripped automatically before parsing, and empty input decodes to an empty object rather than throwing.

## Options

- **part**: `all` (default: header, payload, signature and computed dates), `header` (just the header object) or `payload` (just the payload object).

## Common uses

- Debugging what claims an access or ID token actually carries during API development.
- Checking whether a token has expired, or reading its issued-at and not-before times, without writing code.
- Inspecting the `alg` and `typ` header fields to confirm which signing algorithm a token claims to use.
- Extracting a specific claim (a user ID, a scope list, a tenant identifier) from a token pasted from logs or a browser's dev tools.

## Tips and pitfalls

- This tool never verifies the signature. Decoding a JWT only shows you what it claims, not whether those claims are genuine. Anyone can construct a JWT with any header and payload they like; only a valid signature check (with the right key) proves it was issued by whoever you trust. Never treat a decoded payload as authenticated without verifying the signature server-side; for HMAC-signed (HS256/384/512) tokens, [jwt verify](/util/jwt_verify/) can check it against a secret. An unsigned `alg: none` token with an empty third segment decodes here just like a signed one.
- A `NumericDate` claim that is not a plain number (blank, `"soon"`, `true`) is treated as absent (`null`) rather than misread as the Unix epoch (1970-01-01), so a malformed `exp` does not show up as long expired. But `isExpired` is then `false`, exactly as for a token with no `exp` at all. Numeric strings such as `"1516239022"` are still read as dates.
- Per RFC 7519, the exact moment a token's `exp` time arrives counts as expired, not one second later, and `isExpired` reflects that.
- Malformed tokens fail with a specific reason: the wrong number of dot-separated segments, an empty header or payload segment, invalid base64url, or JSON that does not parse to an object each produce their own error rather than a generic failure.
