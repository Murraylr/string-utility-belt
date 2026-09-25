---
title: Detect Format Online — Identify JSON, Base64, JWT & More
description: Guess whether text is JSON, YAML, CSV, base64, hex, a JWT, a UUID, a URL, Markdown, SQL, gzip and more, with a confidence score for each guess.
---
## What does format detection do?

When you're handed a mystery string — a value copied from a log, a database column, or someone else's
config file — this tool guesses what it is. It runs the text past more than two dozen pattern checks (valid JSON,
YAML-shaped lines, CSV columns, base64 and base32 alphabets, hex digits, JWTs, UUIDs, URLs, IP addresses,
timestamps, Markdown markers, SQL statements, gzip and zlib magic bytes, Morse code, ROT13 and more) and
returns every format that matched, ranked by how confident each guess is. It is a triage tool, not a
parser: it never fails or throws, even on garbage input, and a low-confidence result is still useful
information.

## How it works

Each candidate format gets its own confidence score from 0 to 1, plus a short note explaining the
evidence. A valid JSON object or array is essentially unambiguous, so it scores 0.99 (a bare JSON scalar
such as `42` only gets 0.45), and because valid JSON is also valid JSON5 and valid YAML, those show up
too, at lower confidence:

```example
title: a small JSON object also looks like JSON5 and YAML
input: {"a":1,"b":[2,3]}
output:
[
  {
    "format": "JSON",
    "confidence": 0.99,
    "note": "valid JSON object, 2 keys"
  },
  {
    "format": "JSON5",
    "confidence": 0.45,
    "note": "valid JSON, which is a subset of JSON5"
  },
  {
    "format": "YAML",
    "confidence": 0.3,
    "note": "JSON is also valid YAML"
  }
]
```

Some inputs are unambiguous enough that only one format matches at all. A canonical UUID is recognized
outright, including which version it is:

```example
title: a canonical UUID
input: 550e8400-e29b-41d4-a716-446655440000
output:
[
  {
    "format": "UUID",
    "confidence": 0.99,
    "note": "canonical UUID, version 4"
  }
]
```

A few detectors can fire on the same text for different reasons. A URL that carries a `key=value` query
string also looks a little like a one-line INI `key=value` entry — the tool reports both, but keeps the
weaker guess at a clearly lower confidence:

```example
title: a url with a query string also weakly resembles a config line
input: https://example.com/path?q=1#frag
output:
[
  {
    "format": "URL",
    "confidence": 0.95,
    "note": "https URL"
  },
  {
    "format": "INI",
    "confidence": 0.4,
    "note": "0 sections, 1 key=value line"
  }
]
```

When nothing structured matches at all — ordinary prose in a script that has no dedicated detector, for
example — the tool returns a "plain text" result instead of an empty list. It scores 0.5 when no detector
fired at all, and is added at 0.25 alongside the other candidates when some fired but none reached 0.3:

```example
title: unrecognized prose falls back to "plain text"
input: こんにちは、世界
output:
[
  {
    "format": "plain text",
    "confidence": 0.5,
    "note": "nothing structured matched with confidence"
  }
]
```

Empty input returns an empty list rather than a fallback entry, since there is nothing to guess about.

## What it can detect

JSON, JSON5, YAML, TOML, INI, `.env`, HTML, XML, CSV, TSV, base64 and base64url, hex, base32, URL-encoded
query strings, JWTs, UUIDs, data URIs, gzip and zlib (by magic bytes or a base64-wrapped gzip stream),
email addresses, URLs, IPv4/IPv6 addresses, Unix timestamps, Markdown, SQL statements, Morse code, raw
binary (0/1 strings), and ROT13-obfuscated English text. There are no parameters to configure — you paste
text (or bytes) in, and every detector that fires with a non-zero score comes back, sorted by confidence.

## Common uses

- Figuring out what an unlabeled config file, environment dump, or database export actually is before
  choosing which parser or converter to run on it.
- Sanity-checking that a value really is base64, hex, or a JWT before feeding it into
  [base64 decode](/util/base64_decode/), [hex decode](/util/hex_decode/), or [jwt decode](/util/jwt_decode/).
- Spotting whether a copied string is gzip-compressed, ROT13-obfuscated, or Morse code before manually
  guessing which decoder to reach for.
- A quick first step when triaging support tickets or log lines full of pasted values of unknown origin.

## Tips and pitfalls

- Confidence scores are heuristics, not proof. A short or ambiguous string can score moderately on several
  formats at once — always sanity-check the top guess against the note before trusting it, especially
  around 0.3–0.5.
- A single `key=value`-shaped line (such as `FOO=bar`) will often show up weakly as INI, TOML and `.env`
  at the same time, because all three share that basic shape — each of those detectors caps a one-line
  input at 0.4. A real config file with multiple lines and a section header scores much higher than a
  single ambiguous line does.
- Detection works line by line for some formats (email, URL, IP, UUID) — every line must match for the
  whole input to be reported as that format, so mixing one bad line into an otherwise clean list will drop
  its confidence or remove it from the results entirely.
- This tool identifies structure; it does not validate values within that structure. Once you know a value
  is meant to be, say, an email address or a UUID, run it through [validate](/util/validate/) for a
  stricter format check that gives a specific reason for any failure.
