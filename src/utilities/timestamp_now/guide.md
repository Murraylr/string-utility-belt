---
title: Current Timestamp Generator — Now in Any Format
description: Generate the current time as ISO 8601, Unix seconds or milliseconds, RFC 2822, SQL or a local string, in any time zone, with an optional offset.
---
## What does current timestamp do?

Sometimes you just need "now" — a fresh ISO 8601 instant to paste into a test fixture, a Unix timestamp for an API call, or an RFC 2822 date for an email header. This generator ignores whatever you put in the input box and always emits the current moment, in the format and time zone you choose. Because it depends on the clock, its output is different every time you run it — the worked examples below use a pattern match instead of a fixed value for that reason.

## How it works

Pick a `format` and the tool stamps out the current instant that way. The default is ISO 8601 in UTC:

```example
title: current time as ISO 8601 (varies between runs)
input:
params: {"format": "iso"}
output-matches: ^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$
```

```example
title: current time as unix seconds (varies between runs)
input:
params: {"format": "unix"}
output-matches: ^\d{9,10}$
```

```example
title: current time as a SQL-style timestamp (varies between runs)
input:
params: {"format": "sql"}
output-matches: ^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$
```

```example
title: current time as an RFC 2822 date (varies between runs)
input:
params: {"format": "rfc2822"}
output-matches: ^[A-Za-z]{3}, \d{2} [A-Za-z]{3} \d{4} \d{2}:\d{2}:\d{2} [+-]\d{4}$
```

Setting `format` to `all` returns every representation at once as a JSON object — ISO, Unix seconds and milliseconds, RFC 2822, HTTP, SQL, a long-form English date string, the time zone name as you entered it, its current UTC offset, and the offset you applied — which is convenient when a later pipeline step needs a specific field without re-parsing text.

## Options

- **format** — `iso` (default), `unix`, `unix-ms`, `rfc2822`, `http`, `sql`, `local`, or `all` for every format bundled into one object. `http` is always expressed in GMT, as HTTP requires (RFC 9110, formerly RFC 7231).
- **timezone** — any IANA time zone name (`Europe/Paris`, `America/New_York`, …); defaults to `UTC`. Ignored by `unix`, `unix-ms` and `http`, which are zone-independent or fixed to GMT by definition.
- **offset (seconds)** — shifts the emitted instant forward or backward before formatting; positive moves into the future, negative into the past. The value is truncated toward zero (`1.9` becomes `1`, not rounded to `2`), and a shift far enough to land outside the representable date range throws an error rather than producing garbage.

## Common uses

- Stamping a test fixture, log line or changelog entry with a real "now" value.
- Generating a cache-busting timestamp for a URL or API request.
- Producing "N hours from now" or "N days ago" values with `offsetSeconds`, without a separate calculator.
- Getting the current time pre-converted into a specific time zone for a scheduling UI.

## Tips and pitfalls

- Because the input is ignored, running this in a pipeline means the output changes on every re-run, including every keystroke elsewhere in the pipeline — that is expected, not a bug.
- `offsetSeconds` moves the underlying instant, so combined with `timezone` it correctly crosses midnight and date boundaries in that zone, not just in UTC.
- An out-of-range offset throws, and so does an unknown time zone name in any format that uses the zone, naming the problem, so a typo won't silently fall back to UTC. `unix`, `unix-ms` and `http` never read the zone, so they don't check it.
- For converting a *specific* timestamp you already have (rather than "now"), use [timestamp convert](/util/timestamp_convert/) or [date format](/util/date_format/); to describe an interval instead of an instant, see [humanize duration](/util/duration_humanize/).
