---
title: UUID Generator Online — v4, v7, v1, Nil & Max
description: Generate UUIDs online — random v4, time-ordered v7, timestamp-based v1, or the nil and max sentinel values — with uppercase, hyphen and brace options.
---
## What is a UUID?

A UUID (Universally Unique Identifier, standardized in [RFC 9562](https://datatracker.ietf.org/doc/html/rfc9562)) is a 128-bit value written as 32 hex digits in five hyphenated groups, designed so that two systems generating IDs independently — with no coordination or central authority — essentially never collide. Several "versions" define how those 128 bits are filled in; this tool generates the random v4, the newer time-ordered v7, the legacy time-based v1, and the two special nil and max values.

## How it works

The nil UUID is all zeros — used as an explicit "no value" or "not set" placeholder, distinct from a null or missing field:

```example
title: the nil uuid
input:
params: {"version": "nil"}
output: 00000000-0000-0000-0000-000000000000
```

The max UUID is its opposite — all bits set to one — used as an explicit upper-bound sentinel, for example as the upper end of a range in a database query:

```example
title: the max uuid, uppercase with braces
input:
params: {"version": "max", "uppercase": true, "braces": true}
output: {FFFFFFFF-FFFF-FFFF-FFFF-FFFFFFFFFFFF}
```

**v4** is the familiar all-random UUID, with fixed version and variant bits (the `4` and the `8`/`9`/`a`/`b` you can see fixed in every v4 UUID) and the rest filled with random data:

```example
title: a seeded v4 uuid
input:
params: {"version": "v4", "seed": 42}
output: 8a2bc372-c032-4bda-adb0-73ab8a9ac02c
```

**v7** starts with a 48-bit Unix millisecond timestamp, followed by 74 random bits (split around the version and variant bits), so an ID from a later millisecond sorts after one from an earlier millisecond — a property plain v4 UUIDs do not have, which matters for database index locality when the UUID is a primary key:

```example
title: a seeded v7 uuid
input:
params: {"version": "v7", "seed": 7}
output: 016f6165-fd2c-7c4b-ba16-9e5eb2f38b96
```

**v1** is the older timestamp-based format: a 60-bit clock reading plus a clock sequence and a "node" identifier that was traditionally a device's MAC address. This tool always uses a randomly generated node id with its multicast bit set, so it never leaks any real hardware identifier:

```example
title: a seeded v1 uuid
input:
params: {"version": "v1", "seed": 7}
output: b372c6c0-2c9e-11ea-bf12-5f9e16fa968b
```

## Options

- **version** — `v4` (default, random), `v7` (time-ordered), `v1` (legacy timestamp-based), `nil`, or `max`.
- **count** — how many UUIDs to generate at once, one per line; default `1`, up to 10,000. A `v7` batch stays correctly sorted even when every ID in it shares the same millisecond, because the random portion is incremented for each ID instead of redrawn. A `v1` batch keeps one clock sequence and node id and advances the timestamp by one 100-nanosecond tick per ID, so the IDs are distinct — though v1's field order means its text does not sort by time.
- **uppercase** — renders hex digits as `A-F` instead of `a-f`; off by default.
- **hyphens** — includes the standard `8-4-4-4-12` hyphens; on by default. Turning it off yields a bare 32-character hex string.
- **braces** — wraps the result in `{…}`, the classic Microsoft GUID style; off by default.
- **seed (0 = random)** — `0` (the default) uses the browser's cryptographic random number generator and the real system clock. Any other integer switches to a small non-cryptographic PRNG and reproduces the exact same UUID (or batch) every time, including a fixed simulated clock reading in early 2020 for `v1`/`v7` — useful for tests and documentation, never for anything meant to be unguessable.

## Common uses

- Primary keys for database rows — `v7` in particular is increasingly preferred over `v4` for this because its time-ordering keeps new rows clustered together in index storage rather than scattered randomly.
- Correlation or trace IDs for logging and distributed tracing.
- The nil and max sentinels as explicit placeholder or boundary values in code or queries that otherwise expect a real UUID.

## Tips and pitfalls

- v4 and v7 UUIDs always have `4` or `7` as the first digit of the third group and one of `8`, `9`, `a`, or `b` as the first digit of the fourth group — those are the fixed version and variant bits, not random.
- This tool ignores its input entirely — the input box has no effect on the generated UUID.
- For a shorter, non-standard identifier, see [nanoid](/util/nanoid/); for a sortable ID with an explicitly settable timestamp, see [ulid](/util/ulid/).
- To generate matching test values (names, emails, and so on) alongside a UUID for a fixture row, see [fake data](/util/fake_data/).
