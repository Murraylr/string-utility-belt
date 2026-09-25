---
title: Random String Generator — Custom Character Sets
description: Generate random strings online from alphanumeric, hex, symbol or fully custom character sets, with a length, count and seed you control.
---
## What is a random string generator?

A random string generator draws characters uniformly at random from a chosen alphabet to build a string of a given length — no character-class guarantees, no pronounceability, just uniform sampling from whatever set of characters you pick. That makes it a good fit for API tokens, test fixtures, CSS class names, or any place you need filler text with a specific, predictable shape rather than a memorable password (for that, see [password generator](/util/password_generator/) instead).

## How it works

Pick a length and a character-set preset:

```example
title: a default alphanumeric string (seeded for a reproducible example)
input:
params: {"length": 12, "seed": 42}
output: KESvO50HW7tf
```

The `hex` preset is handy for generating a stand-in for a hash or token in a fixed-width hexadecimal shape:

```example
title: a seeded hex string
input:
params: {"length": 8, "charset": "hex", "seed": 42}
output: ca0da341
```

For anything the presets do not cover, switch the character set to `custom` and write your own spec, including `a-z`-style ranges:

```example
title: a custom character range
input:
params: {"charset": "custom", "custom": "ab-d", "length": 8, "seed": 5}
output: adcbdadd
```

The `all` preset draws from every printable ASCII character except the space — letters, digits, and punctuation together:

```example
title: the "all" preset (letters, digits and symbols)
input:
params: {"charset": "all", "length": 12, "seed": 9}
output: k[w!xzkFH4O@
```

A length of zero returns an empty string:

```example
title: a length of zero
input:
params: {"length": 0}
output:
```

## Options

- **length** — how many characters long the string should be; default `16`, from 0 to 4096.
- **character set** — one of the presets below, or `custom`.
- **custom characters (a-z ranges ok)** — only used when the character set is `custom`; write literal characters or `a-z`-style ranges. A leading or trailing `-` is treated as a literal dash. The set is split into Unicode code points, so most single emoji and other characters outside the Basic Multilingual Plane stay whole, but multi-code-point sequences (flags, skin-tone emoji, a letter plus combining accent) are split into their parts. A character written twice is twice as likely to be drawn.
- **count** — how many strings to generate at once, one per line; default `1`, up to 10,000. The total output (`length × count`) is capped at 1,000,000 characters.
- **seed (0 = random)** — `0` (the default) draws from the browser's cryptographic random number generator, so every run is unpredictable. Any other integer switches to a small non-cryptographic PRNG and reproduces the exact same output every time — useful for tests and documentation, never for anything that needs to be unguessable.

The built-in presets:

| character set | characters used |
| --- | --- |
| `alphanumeric` (default) | `a-z`, `A-Z`, `0-9` |
| `alpha` | `a-z`, `A-Z` |
| `lowercase` | `a-z` |
| `uppercase` | `A-Z` |
| `numeric` | `0-9` |
| `hex` | `0-9`, `a-f` |
| `symbols` | printable ASCII punctuation (32 characters) |
| `all` | alphanumeric plus symbols (94 characters) |
| `custom` | whatever you write in the custom-characters field |

## Common uses

- Placeholder API keys, tokens, or IDs in test fixtures and documentation.
- Random suffixes to avoid collisions in generated filenames or database test rows.
- Sample values for a hex-shaped field (a color code, a short hash stand-in) where an exact byte layout does not matter.

## Tips and pitfalls

- This tool ignores its input entirely — the input box has no effect on the generated string.
- Every entry in the chosen set (so every character, unless a custom set lists one twice) is equally likely on every draw (rejection sampling avoids the modulo bias a naive `random % n` would add), and nothing outside the set is ever produced.
- For a genuinely unpredictable token meant for production use (a session ID, an API secret), leave the seed at `0` — a non-zero seed exists purely to make output reproducible for tests and documentation.
- If you need raw random bytes rather than a printable string, use [random bytes](/util/random_bytes/) instead; if you need a specifically ID-shaped value, see [nanoid](/util/nanoid/) or [uuid](/util/uuid/).
