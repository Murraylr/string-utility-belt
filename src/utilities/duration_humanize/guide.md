---
title: Duration Humanizer: Seconds to Readable Time Online
description: Turn seconds or milliseconds into a readable duration like "1h 30m", or parse durations, clock times, and ISO 8601 back into a number.
---
## What does duration humanize do?

Computers measure elapsed time in seconds or milliseconds (`5400`, `93784.5`), which nobody wants to read in a UI, a log line or a changelog. This tool converts that number into a readable duration such as "1 hour 30 minutes", "1h 30m", a clock-style "1:30:00", or an ISO 8601 duration ("PT1H30M"). It also runs in reverse, parsing any of those readable forms (plus a wide range of shorthand like "1 hour and 30 minutes" or "500ms") back into a plain number.

## How it works

By default the tool reads the input as a number of seconds and writes it out as a long-form phrase, from the largest non-zero unit down:

```example
title: seconds to a readable phrase
input: 5400
output: 1 hour 30 minutes
```

Internally the value is decomposed into whole days, hours, minutes, seconds and milliseconds. Output starts at the largest non-zero unit and covers at most `maxUnits` consecutive units from there (two by default); smaller units are dropped, not rounded, so `5459` still reads "1 hour 30 minutes", and a zero unit in between uses up a slot, so `3601` reads "1 hour":

```example
title: a short style keeps the same two units, more compactly
input: 5400
params: {"style": "short"}
output: 1h 30m
```

```example
title: iso8601 style, for machine-readable durations
input: 5400
params: {"style": "iso8601"}
output: PT1H30M
```

Set `direction` to `to-seconds` to parse a readable duration back into a number. The parser understands plain numbers, colon-separated clock times (`1:30:00`), ISO 8601 durations (`PT1H30M`), and free-form human text combining a number and a unit word (`1h 30m`, `1 hour and 30 minutes`, `90 mins`):

```example
title: parse a colon-style duration back to seconds
input: 1:30:00
params: {"direction": "to-seconds"}
output: 5400
```

Fractional input keeps its fraction rather than rounding it away, as long as the fraction falls within the units shown:

```example
title: fractional seconds are preserved
input: 1.5
output: 1 second 500 milliseconds
```

Negative durations are supported too. The sign is applied to the whole rendered string:

```example
title: a negative duration keeps its sign
input: -5400
output: -1 hour 30 minutes
```

## Options

- **direction**: `to-human` (default) turns a number into a readable duration; `to-seconds` parses a readable duration back into a number, expressed in the chosen `unit`.
- **number unit**: whether the numeric side of the conversion is `seconds` (default) or `milliseconds`: it sets how a plain-number input is read and, for `to-seconds`, the unit of the number written out. Unit words in the input (`h`, `min`, `ms`, …) are always honored as written.
- **style**: how a human-readable duration is rendered: `long` ("1 hour 30 minutes"), `short` ("1h 30m"), `colon` ("1:30:00", growing to `D:HH:MM:SS` for multi-day spans), or `iso8601` ("PT1H30M"). Only used for `to-human`.
- **max units (0 = all)**: how many consecutive units, counted from the largest non-zero one, to show in `long`/`short`/`iso8601` output (default 2); `0` shows every non-zero unit down to milliseconds. `colon` style ignores this and always shows every field down to seconds (plus a fractional millisecond suffix when needed).
- **one duration per line**: on by default, so each line of a multi-line input is converted independently; blank lines are preserved.

When parsing free-form text, the recognized unit words include `ns`/`nanosecond(s)`, `us`/`µs`/`microsecond(s)`, `ms`/`millisecond(s)`, `s`/`sec(s)`/`second(s)`, `m`/`min(s)`/`minute(s)`, `h`/`hr(s)`/`hour(s)`, `d`/`day(s)`, `w`/`wk(s)`/`week(s)`, `mo`/`month(s)` (treated as an approximate 30 days) and `y`/`yr(s)`/`year(s)` (an approximate 365 days). Months and years are accepted on the way in because people write them, but the tool never *emits* them, since their real length varies with the calendar.

## Common uses

- Displaying a countdown, a job's runtime, or a cache TTL in a UI without shipping a whole date library.
- Converting a human-typed duration ("2h 15m") from a form field into seconds for an API or database column.
- Normalizing durations copied from different sources (a clock time from one system, an ISO 8601 duration from another) into one consistent format.
- Round-tripping a duration through a pipeline: humanize it for display, then parse it back for further math (with max units set to 0, so nothing is dropped).

## Tips and pitfalls

- `colon` style has no room for a fraction of a millisecond in its seconds field, so a value like `1.9996` seconds rounds to the nearest whole millisecond before formatting (`0:02`), while `long`, `short` and `iso8601` styles keep the exact fraction.
- Humanizing and then parsing back with `to-seconds` returns the original number only if nothing was dropped: with the default max units of 2, `3661` becomes "1 hour 1 minute" and parses back as `3660`. Set max units to `0` for an exact round trip (or use `colon`, which keeps every field to the millisecond).
- An unrecognized unit word (`1 fortnight`), a colon field after the first one that is 60 or more, or leftover text the parser can't attach to a number (`30m ⏱`) all throw a clear error rather than silently dropping data.
- To format a specific instant rather than a span, see [timestamp convert](/util/timestamp_convert/) and [date format](/util/date_format/); to read a cron schedule in plain English, see [cron describe](/util/cron_describe/).
