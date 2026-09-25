---
title: Unix Timestamp Converter — Epoch to Date Online
description: Convert Unix, ISO 8601, RFC 2822, SQL and other timestamps to any format or time zone, with auto-detection of the input's format.
---
## What is a Unix timestamp?

A Unix timestamp counts seconds (or milliseconds) since 1970-01-01T00:00:00Z. It is compact and unambiguous for computers, but useless to read at a glance, and in practice you run into half a dozen other timestamp shapes too: ISO 8601 (`2024-03-15T09:30:00Z`), RFC 2822 email dates, HTTP dates, SQL `DATETIME` strings, even .NET ticks or Excel's day-serial numbers. This tool auto-detects whichever of those you paste in and converts it to any of the others, in any time zone.

## How it works

Paste a timestamp and pick a target format with `to`. The tool figures out what kind of timestamp it is from its shape and magnitude, then renders it:

```example
title: unix seconds to ISO 8601
input: 1710494400
params: {"to": "iso"}
output: 2024-03-15T09:20:00.000Z
```

```example
title: ISO 8601 to unix seconds
input: 2024-03-15T09:30:00Z
params: {"to": "unix"}
output: 1710495000
```

The auto-detection is magnitude-based for plain numbers: 18 or more digits is read as .NET ticks (100-nanosecond intervals since year 1), 15+ digits as microseconds, 12–14 digits as milliseconds, 7–11 digits as seconds, and any positive number below 1,000,000 as an Excel day-serial number (since a value that small is far more likely to be a spreadsheet date than a timestamp within 11 days of the epoch). Text is matched against ISO 8601, SQL (`YYYY-MM-DD HH:MM:SS`), RFC 2822, HTTP-date and C's `asctime` patterns before falling back to a general date parser.

Set `timezone` to any IANA zone name to control what wall-clock time the `iso`, `sql`, `rfc2822` and `local` outputs show, and how a zone-less ISO, SQL or free-form timestamp is interpreted (an RFC 2822 or `asctime` date without a zone is read as GMT):

```example
title: render in a named time zone
input: 1705314600
params: {"to": "sql", "timezone": "Asia/Tokyo"}
output: 2024-01-15 19:30:00
```

A SQL-style timestamp with no time zone attached is read as wall-clock time *in the zone you specify*, not UTC, which matters once you convert it onward:

```example
title: a naive timestamp is read as local time in that zone
input: 2024-01-15 05:30:00
params: {"to": "iso", "timezone": "America/New_York"}
output: 2024-01-15T05:30:00.000-05:00
```

Set `to` to `relative` for a human phrase like "3 hours ago" or "in 2 days", computed against the moment the pipeline runs — since that reference point changes, this is the one output that varies between runs:

```example
title: relative time compares against right now (varies between runs)
input: 0
params: {"to": "relative"}
output-matches: ago$
```

## Options

- **convert to** — `all` (default; every format at once, as a JSON object including the detected input format, UTC offset, weekday and more), or one of `iso`, `unix`, `unix-ms`, `rfc2822`, `http`, `sql`, `local`, `relative`.
- **timezone** — any IANA time zone name; defaults to `UTC`.
- **one timestamp per line** — on by default, converting each line independently; blank lines are preserved in single-format output, while `all` skips them and returns a JSON array with one object per timestamp. When off, the whole (trimmed) input is treated as one timestamp.

## Common uses

- Turning an API's Unix timestamp field into a readable date for a report or ticket.
- Converting a log timestamp between time zones while investigating an incident.
- Checking what format a mystery numeric value actually is — the `all` mode's `detected` field names it (`unix-seconds`, `unix-milliseconds`, `unix-microseconds`, `excel-serial`, `dotnet-ticks`, `iso8601`, `sql`, `rfc2822`, `http-date` or `date-string`).
- Generating an `HTTP`-date or `RFC 2822` string for a header or email from a Unix timestamp.

## Tips and pitfalls

- A number can only be read one way, so a small integer meant as a timestamp near the epoch (say, `500000`) will instead be read as an Excel serial date far in the future, and a 19-digit Unix nanosecond value (as Go or InfluxDB write them) will be read as .NET ticks — that ambiguity is inherent to bare numbers, not a bug.
- HTTP-dates are always rendered in GMT, as HTTP requires (RFC 9110, which replaced RFC 7231), whatever the `timezone` option says; the option can still change which instant a zone-less input means.
- A date beyond the widest representable instant, or an impossible calendar date like `2024-02-31`, throws a clear error instead of silently producing a wrong result.
- To apply a custom display pattern instead of a fixed target format, use [date format](/util/date_format/); for the current moment rather than a supplied one, use [current timestamp](/util/timestamp_now/); to turn the gap between two timestamps into a phrase like "2 hours", convert both to `unix`, subtract, and give the difference to [humanize duration](/util/duration_humanize/).
