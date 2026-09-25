---
title: Validate Email, URL, UUID & More Online — Format Check
description: Check whether text is a valid email, URL, UUID, IP address, semver, credit card, ISBN, date, JWT, slug, or 8 other formats, with clear reasons.
---
## What does this validate?

This tool checks a piece of text against the rules of a specific format — email address, URL, UUID, IPv4
or IPv6 address, semantic version, credit card number, ISBN, MAC address, hex color, JSON, base64, date,
ISO 8601 date-time, domain name, port number, JWT, slug, or hostname — and tells you whether it's valid.
When it's valid, you usually also get a normalized form; when it isn't, you get a specific reason rather
than a plain yes/no. These are syntax and checksum checks only — nothing is looked up online, so a valid
email address or URL is not proof that it exists.

## How it works

Pick a **type**, and the input is checked against that format's rules:

```example
title: a valid email address
params: {"type": "email"}
input: user@example.com
output:
{
  "type": "email",
  "value": "user@example.com",
  "valid": true,
  "reason": "valid email address",
  "normalized": "user@example.com"
}
```

When a value fails, the reason names exactly what's wrong instead of just saying "invalid":

```example
title: an invalid email explains why
params: {"type": "email"}
input: not-an-email
output:
{
  "type": "email",
  "value": "not-an-email",
  "valid": false,
  "reason": "missing \"@\""
}
```

Several validators recognize a common mistake and suggest the fix in the reason itself. A 32-character hex
string that's missing its hyphens is recognized as an almost-UUID, not just rejected outright:

```example
title: a near-miss is explained, not just rejected
params: {"type": "uuid"}
input: 550e8400e29b41d4a716446655440000
output:
{
  "type": "uuid",
  "value": "550e8400e29b41d4a716446655440000",
  "valid": false,
  "reason": "missing hyphens (did you mean 550e8400-e29b-41d4-a716-446655440000?)"
}
```

The same near-miss handling exists for slugs: an invalid slug still gets a normalized suggestion, even
though it's reported as invalid:

```example
title: an invalid slug still gets a usable suggestion
params: {"type": "slug"}
input: Héllo Wörld!
output:
{
  "type": "slug",
  "value": "Héllo Wörld!",
  "valid": false,
  "reason": "contains uppercase letters",
  "normalized": "hello-world"
}
```

`jwt` checks that the token has three well-formed base64url segments whose header and payload decode to
JSON, and reports the algorithm and expiry claim if present — but it never checks the signature itself,
since that requires a secret or key this tool doesn't have:

```example
title: a well-formed JWT is not the same as a verified one
params: {"type": "jwt"}
input: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c
output:
{
  "type": "jwt",
  "value": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c",
  "valid": true,
  "reason": "well-formed JWT (alg HS256); the signature is not verified"
}
```

Turn on **validate each line** to check every non-blank line of the input separately and get a summary
alongside the per-line results:

```example
title: validating a whole list of lines at once
params: {"type": "email", "perLine": true}
input:
a@b.com
nope

  josé@exämple.de  
output:
{
  "type": "email",
  "total": 3,
  "validCount": 2,
  "invalidCount": 1,
  "results": [
    {
      "value": "a@b.com",
      "valid": true,
      "reason": "valid email address",
      "normalized": "a@b.com"
    },
    {
      "value": "nope",
      "valid": false,
      "reason": "missing \"@\""
    },
    {
      "value": "josé@exämple.de",
      "valid": true,
      "reason": "valid email address",
      "normalized": "josé@exämple.de"
    }
  ]
}
```

## Options

- **type** — the format to check against: `email`, `url`, `uuid`, `ipv4`, `ipv6`, `semver`, `credit-card`,
  `isbn`, `mac`, `hex-color`, `json`, `base64`, `date`, `iso8601`, `domain`, `port`, `jwt`, `slug`, or
  `hostname`. Defaults to `email`.
- **validate each line** — off by default. When on, blank lines are skipped and every remaining line is
  validated on its own, with a summary of how many passed and failed.

## Common uses

- Checking user-submitted data (emails, URLs, identifiers like credit card numbers or ISBNs) before it
  goes into a form, database, or API request.
- Validating a batch of values — a list of emails from a spreadsheet, a list of UUIDs from a database
  export — all at once with **validate each line**.
- Confirming a version string is valid SemVer, a date is a real calendar date, or a JSON blob actually
  parses before using it somewhere that expects strict input.
- Sanity-checking configuration values like ports, hostnames, and domain names.

## Tips and pitfalls

- Several validators return a **normalized** form even when the input differs only cosmetically from it —
  an email's domain is lowercased, IPv6 addresses are compressed per RFC 5952, and a UUID's hex digits are
  lowercased — so you can use `normalized` as a canonical form once a value passes.
- `email` uses pragmatic rules, not the full RFC 5322 grammar: a local part of up to 64 characters (quoted
  local parts and non-ASCII letters are allowed), a domain of at least two labels with an alphabetic or
  `xn--` top-level domain, and 254 characters overall. IP-address domains such as `user@[192.168.0.1]` are
  rejected.
- `url` accepts anything the browser's WHATWG URL parser accepts as an absolute URL, with any scheme — only
  `http`, `https`, `ftp`, `ftps`, `ws` and `wss` URLs are also required to have a host. A value like
  `javascript:alert(1)` is reported as a valid URL, so check the scheme yourself before using a URL from
  untrusted input.
- `credit-card` accepts 12–19 digits (spaces and hyphens allowed) and checks only the Luhn checksum. The
  brand it names (Visa, Mastercard, American Express, and others) is a guess from the leading digits and
  does not affect validity, and it says nothing about whether the card is real, active, or unexpired.
- `date` reads `YYYY-MM-DD` (optionally followed by a time), `MM/DD/YYYY` (US order) and `DD.MM.YYYY`,
  and checks those against the real calendar. Anything else falls back to JavaScript's lenient
  `Date.parse`, which varies between browsers, rolls impossible dates over (`Feb 30 2024` becomes
  1 March) and interprets times in your local time zone. Use `iso8601` for strict checking.
- `jwt` here is purely structural: it decodes the header and payload and reports the claimed algorithm and
  expiry, but never verifies a signature or compares the expiry with the current time. To read the claims,
  see [jwt decode](/util/jwt_decode/); to check an HMAC (HS256/384/512) signature, see
  [jwt verify](/util/jwt_verify/).
- `iso8601` accepts calendar dates, week dates, ordinal dates, years, year-months, date-times, durations,
  and two-part intervals — a plain date like `2024-03-01` is valid ISO 8601, but so is a duration like
  `P3Y6M4D` or an interval like `2024-01-01/P1M`. Recurring intervals (`R5/…`) are not accepted.
- For pulling values like emails or URLs out of a larger block of text rather than checking one value you
  already have, see [extract matches](/util/extract_preset/).
