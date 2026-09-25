---
title: ULID Generator Online — Sortable Unique IDs
description: Generate lexicographically sortable ULIDs online — a 48-bit timestamp plus 80 random bits in Crockford base32 — monotonic within a batch.
---
## What is a ULID?

A ULID (Universally Unique Lexicographically Sortable Identifier) packs a 48-bit millisecond timestamp and 80 bits of randomness into a 26-character string, encoded in Crockford's base32 alphabet. The point of putting the timestamp first is that ULIDs sort correctly as plain strings — unlike a random UUIDv4, where two IDs' ordering tells you nothing about which was created first. That makes ULIDs a popular choice for database primary keys and event IDs where insertion order matters for index locality or debugging, while still being effectively collision-free.

## How it works

The first 10 characters encode the timestamp; the remaining 16 encode 80 bits of randomness:

```example
title: a ulid at a fixed timestamp (seeded for a reproducible example)
input:
params: {"timestamp": 1700000000000, "seed": 42}
output: 01HF7YAT00XXY75GSBHBD3PCP0
```

Generating several IDs at once produces a **monotonic** batch: every ID after the first increments the random portion by one instead of redrawing it, so a batch minted within the same millisecond still sorts in the exact order it was generated, and IDs never collide within a run:

```example
title: a monotonic batch of three
input:
params: {"count": 3, "timestamp": 1700000000000, "seed": 42}
output: 01HF7YAT00XXY75GSBHBD3PCP0
01HF7YAT00XXY75GSBHBD3PCP1
01HF7YAT00XXY75GSBHBD3PCP2
```

This tool's encoding matches the example documented by the reference JavaScript `ulid` library: Unix time `1469918176385` ms encodes to the 10-character prefix `01ARYZ6S41`:

```example
title: reproducing the reference library's example timestamp
input:
params: {"seed": 42, "timestamp": 1469918176385, "count": 3}
output: 01ARYZ6S41XXY75GSBHBD3PCP0
01ARYZ6S41XXY75GSBHBD3PCP1
01ARYZ6S41XXY75GSBHBD3PCP2
```

With no timestamp or seed supplied, every ULID reflects the current time and fresh randomness, so only the general shape is fixed:

```example
title: a real-time ulid
input:
output-matches: ^[0-9A-HJKMNP-TV-Z]{26}$
```

## Options

- **count** — how many ULIDs to generate at once, one per line; default `1`, up to 10,000.
- **timestamp ms (0 = now)** — the Unix millisecond timestamp to encode; `0` (the default) uses the current time. The maximum is `281474976710655` (2^48 − 1), the largest value that fits in the 48-bit time field — that corresponds to the year 10889.
- **seed (0 = random)** — `0` (the default) draws fresh randomness from the browser's cryptographic random number generator on every run. Any other integer switches to a small non-cryptographic PRNG and reproduces the exact same output every time, including the timestamp (a seed-derived instant in early 2020) when one is not explicitly given — useful for tests and documentation, but not for anything that needs to be unguessable.

## Common uses

- Database primary keys or event IDs where you want both global uniqueness and chronological sortability as plain strings or bytes.
- Log or trace identifiers where being able to eyeball approximate creation time from the ID itself is convenient.
- Replacing an auto-increment integer ID with something that can be generated client-side before a record is persisted, while still sorting roughly in creation order (to the millisecond).

## Tips and pitfalls

- Crockford's base32 alphabet deliberately excludes `I` and `L` (easily confused with `1`), `O` (confused with `0`), and `U` (to avoid accidentally spelling obscenities) — a ULID never contains those four letters.
- This tool ignores its input entirely — the input box has no effect on the generated ULID.
- Monotonicity only holds within one batch (one call to this tool); generating one ULID at a time in separate calls does not guarantee strict ordering if two calls land in the same millisecond.
- For the standard 36-character hyphenated identifier format instead, see [uuid](/util/uuid/) (its `v7` version is also time-ordered, though it packs its timestamp and randomness differently); for a shorter non-sortable ID, see [nanoid](/util/nanoid/).
