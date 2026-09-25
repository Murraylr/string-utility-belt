---
title: Nano ID Generator Online — Random Unique IDs
description: Generate URL-safe Nano IDs online from the standard alphabet or your own custom character ranges, with a seed for reproducible test IDs.
---
## What is a Nano ID?

A Nano ID is a compact, URL-safe unique identifier, popularized by the [nanoid](https://github.com/ai/nanoid) JavaScript library as a smaller alternative to a UUID. Where a standard UUID is always 36 characters (including four hyphens) and encodes version and variant bits, a Nano ID is just random characters drawn from a chosen alphabet at whatever length you ask for — this tool defaults to the same 21-character length and the same 64 URL-safe characters (`A-Za-z0-9_-`) as the reference library, so IDs generated here are drop-in compatible with that convention. With 6 bits per character, a default ID carries 126 random bits, slightly more than a v4 UUID's 122.

## How it works

Ask for a size and this tool draws that many characters from the alphabet, uniformly at random:

```example
title: a default-alphabet id (seeded for a reproducible example)
input:
params: {"size": 10, "seed": 42}
output: 8KAtKTUBeB
```

A **digits-only** alphabet, for when you need a shorter, purely numeric code such as a one-time verification code:

```example
title: a digits-only id
input:
params: {"size": 6, "alphabet": "0-9", "seed": 42}
output: 604587
```

The alphabet field accepts ranges much like a regular-expression character class (though without escapes or negation) — `a-c` expands to `a`, `b`, `c` — so you are not limited to typing out every character by hand:

```example
title: a custom three-letter alphabet written as a range
input:
params: {"size": 10, "alphabet": "a-c", "seed": 42}
output: abacaabcaa
```

A size of zero returns an empty string:

```example
title: a size of zero
input:
params: {"size": 0}
output:
```

## Options

- **size** — how many characters long the ID should be; default `21`, from 0 to 4096.
- **alphabet (a-z ranges ok)** — the characters to draw from; default `A-Za-z0-9_-` (64 characters). Write `a-z`-style ranges to expand a whole span at once — a leading or trailing `-` in the spec is treated as a literal dash rather than the start of a range. The alphabet is split into Unicode code points, so characters outside the Basic Multilingual Plane (most single emoji) stay whole and never become broken surrogate halves, even across a range — but a multi-code-point sequence such as a flag, a skin-tone emoji, or a letter plus combining accent is split into its separate code points. Repeated characters count once per occurrence, making them more likely.
- **count** — how many IDs to generate at once, one per line; default `1`, up to 10,000. The total output (`size × count`) is capped at 1,000,000 characters.
- **seed (0 = random)** — `0` (the default) draws from the browser's cryptographic random number generator, so every run is unpredictable. Any other integer switches to a small non-cryptographic PRNG and reproduces the exact same ID (or batch of IDs) every time, which is what makes the examples on this page repeatable — do not rely on a non-zero seed for anything that needs to be unguessable.

## Common uses

- Primary keys or public-facing identifiers for database records, where a UUID's 36 characters and fixed hyphen layout are more than you need.
- React/Vue list keys, DOM element IDs, or short-lived request/trace IDs.
- Generating a run of test IDs for fixtures, with a fixed seed so the fixture data stays stable across test runs.

## Tips and pitfalls

- A larger alphabet needs fewer characters to reach the same unpredictability as a smaller one — the digits-only example above is far more guessable per character than the default alphabet, so keep sizes proportionally longer for small alphabets.
- This tool ignores its input entirely — the input box has no effect on the generated ID.
- For the RFC-standard 36-character identifier format instead, see [uuid](/util/uuid/); for a sortable, timestamp-prefixed ID, see [ulid](/util/ulid/).
- For a plain random string rather than an ID-shaped token, [random string](/util/random_string/) offers similar custom-alphabet support with preset character sets built in.
