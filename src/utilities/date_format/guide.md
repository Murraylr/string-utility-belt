---
title: Date Format Converter — Reformat Dates & Timestamps Online
description: Reformat any date or timestamp with token or strftime patterns, convert time zones, and localize month and weekday names, right in your browser.
---
## What does date format do?

This tool takes a date or timestamp in almost any common shape — a Unix timestamp, an ISO 8601 string, a SQL-style datetime, an RFC 2822 date, even a loosely formatted string like "January 15, 2024" — and rewrites it using a format pattern you choose, in the time zone and locale you choose. It is the same job as JavaScript's `Intl.DateTimeFormat`, Moment/Day.js format tokens or C's `strftime`, unified behind one input box.

## How it works

Each non-blank line of the input is parsed on its own (auto-detecting its shape), then rendered with the `format` pattern:

```example
title: default format
input: 2024-03-15T09:30:00Z
output: 2024-03-15 09:30:00
```

The tool recognizes two pattern styles automatically. Token patterns use letter codes such as `YYYY` (4-digit year), `MM` (2-digit month), `DD` (2-digit day), `HH:mm:ss` (24-hour time) or `dddd` (full weekday name) — the vocabulary Moment.js and Day.js use. As soon as a pattern contains a real `%` directive, it is treated as a `strftime` pattern instead, using codes like `%Y-%m-%d` or `%A, %B %d, %Y`:

```example
title: strftime pattern with localized names
input: 2024-03-15T09:30:00Z
params: {"format": "%A, %B %d, %Y", "locale": "en-US"}
output: Friday, March 15, 2024
```

Literal text that would otherwise be read as a token can be protected in `[square brackets]`, or a single character can be escaped with a backslash:

```example
title: bracketed literal text
input: 2024-01-15T10:30:00Z
params: {"format": "[Today is] dddd"}
output: Today is Monday
```

Setting `timezone` to any IANA zone name (`America/New_York`, `Asia/Tokyo`, `Europe/Paris`, …) converts the instant into that zone's wall-clock time before formatting, with the standard or daylight-saving offset in force at that instant. The `z` token prints the short zone name the locale provides — `EST` for New York in `en-US`, but `GMT+9` for Tokyo, which has no English abbreviation in the locale data:

```example
title: convert to a named time zone
input: 2024-01-15T10:30:00Z
params: {"format": "YYYY-MM-DD HH:mm z", "timezone": "America/New_York"}
output: 2024-01-15 05:30 EST
```

An ISO-style or free-form timestamp that carries no time zone of its own — a bare `2024-01-15 10:30:00`, for instance — is read as wall-clock time *in the zone you asked for*, not in UTC and not in your computer's local zone. (RFC 2822 and `asctime`-style dates without a zone are the exception: they are read as GMT.) That matters when you convert it back to a Unix timestamp:

```example
title: a naive timestamp is read in the target zone, not UTC
input: 2024-01-15 10:30:00
params: {"format": "X", "timezone": "Asia/Tokyo"}
output: 1705282200
```

## Options

- **format** — the pattern to render, as a token pattern (`YYYY-MM-DD HH:mm:ss`, the default) or a `strftime` pattern (`%Y-%m-%d`). An empty value falls back to the default.
- **timezone** — any IANA time zone name; defaults to `UTC`. Controls what wall-clock time the output shows, and how a zone-less ISO-style or free-form input is interpreted.
- **locale** — a BCP 47 locale tag (`en-US`, `fr-FR`, `ja-JP`, …) used for month names, weekday names and the localized `%c`/`%x`/`%X` strftime codes. Defaults to `en-US`.
- **one date per line** — on by default, so a multi-line input is formatted line by line (blank lines pass through unchanged). Turn it off to treat the entire input as a single value.

Common token codes include `YYYY`/`YY` (year), `MM`/`M` (month number), `MMMM`/`MMM` (month name), `DD`/`D` (day), `dddd`/`ddd` (weekday name), `HH`/`H` (24-hour), `hh`/`h` (12-hour), `mm`/`ss` (minute/second), `A`/`a` (AM/PM), `Z`/`ZZ` (UTC offset), `z`/`zz` (zone abbreviation), and `X`/`x` (Unix seconds/milliseconds). The strftime equivalents cover the same ground with `%Y %m %d %A %H %I %M %S %p %z %Z %s`, plus flags like `%-d` (no leading zero) and `%_d` (space-padded).

## Common uses

- Turning a raw API timestamp into a human-readable date for a report, email or UI mockup.
- Converting a log timestamp between time zones when debugging an incident across regions.
- Producing a `strftime`-style format for a shell script, config file or another language's date library.
- Localizing a date for display in a specific language without pulling in a date library.

## Tips and pitfalls

- Bracket every literal word in a token pattern. Letters such as `M`, `D`, `H`, `h`, `m`, `s`, `A`, `a` and `d` are tokens, so an unbracketed `is` renders as `i` followed by the seconds, and `at` as the am/pm marker followed by `t`.
- Feeding a date past the widest representable instant (`+275760-09-13T00:00:00Z`) or an invalid calendar date (`2024-02-30`) throws a clear error rather than silently rolling over to a nearby date.
- An empty format falls back to the default `YYYY-MM-DD HH:mm:ss`, so leaving the box empty never breaks the pipeline.
- If you need to work with the parsed pieces (Unix seconds, ISO 8601, RFC 2822, a relative "3 hours ago" string) rather than a custom pattern, [timestamp convert](/util/timestamp_convert/) exposes those directly. For the current moment instead of a supplied date, use [current timestamp](/util/timestamp_now/), and for turning an interval into a readable span like "1 hour 30 minutes", use [humanize duration](/util/duration_humanize/).
