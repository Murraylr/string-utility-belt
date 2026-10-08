---
title: Cron Expression Describer: Explain Cron Schedules
description: Translate a cron expression into plain English online, with a field-by-field breakdown, locale support, and JSON output for automation schedules.
---
## What is a cron expression?

A cron expression is the compact schedule syntax used by Unix `cron`, CI pipelines, Kubernetes `CronJob`s and countless job schedulers: five space-separated fields for minute, hour, day of month, month and day of week, each holding a value, a wildcard `*`, a range (`1-5`), a list (`1,15,30`) or a step (`*/15`). It is precise but unreadable at a glance: `0 9 * * 1-5` says nothing to most people until you know the field order. This tool reads an expression and produces a plain-English sentence plus a breakdown of what each field means, so you can check a schedule before you ship it.

## How it works

Paste one cron expression (only the first non-blank line is read). The tool splits it into fields, matches the count to a field layout, and asks [cronstrue](https://github.com/bradymholt/cRonstrue) for an overall English sentence while building its own field-by-field table:

```example
title: a weekday morning schedule
input: 0 9 * * MON-FRI
output: At 09:00, Monday through Friday

minute        0        minute 0
hour          9        hour 9
day of month  *        every day of the month
month         *        every month
day of week   MON-FRI  Monday through Friday
```

Fields accept the usual cron syntax (wildcards, ranges, comma lists and steps, where `*/15` = every 15 units), plus the Quartz extensions many schedulers borrow: `L` and `LW` (last day / last weekday of the month), `L-3` (3 days before month end), `15W` (weekday nearest the 15th), `5#2` (the second Friday) and `5L` (the last Friday). Weekday numbers here use the default 0-based numbering, where 5 is Friday. A 6-field expression is read as seconds-first unless its last field is a 4-digit year or its third or fifth field is `?`, in which case it is read minute-first with a trailing year; a 7-field expression always ends in a year.

`@yearly`, `@annually`, `@monthly`, `@weekly`, `@daily`, `@midnight` and `@hourly` expand to their standard 5-field equivalents, and `@reboot` is reported as a special one-off event rather than a schedule:

```example
title: the reboot alias is not a recurring schedule
input: @reboot
output: At system startup

special  @reboot  At system startup
```

Set `format` to `json` to get a structured result instead of the sentence-and-table text. That is useful when a later pipeline step needs to read the schedule programmatically rather than display it:

```example
title: json output for a step schedule
input: */15 * * * *
params: {"format": "json"}
output:
{
  "expression": "*/15 * * * *",
  "description": "Every 15 minutes",
  "fields": [
    {
      "field": "minute",
      "value": "*/15",
      "description": "every 15 minutes"
    },
    {
      "field": "hour",
      "value": "*",
      "description": "every hour"
    },
    {
      "field": "day of month",
      "value": "*",
      "description": "every day of the month"
    },
    {
      "field": "month",
      "value": "*",
      "description": "every month"
    },
    {
      "field": "day of week",
      "value": "*",
      "description": "every day of the week"
    }
  ]
}
```

`@` aliases resolve before any other option is applied, so locale and 12/24-hour settings still take effect:

```example
title: the weekly alias expands to Sunday at midnight
input: @weekly
params: {"format": "json"}
output:
{
  "expression": "0 0 * * SUN",
  "description": "At 00:00, only on Sunday",
  "fields": [
    {
      "field": "minute",
      "value": "0",
      "description": "minute 0"
    },
    {
      "field": "hour",
      "value": "0",
      "description": "hour 0"
    },
    {
      "field": "day of month",
      "value": "*",
      "description": "every day of the month"
    },
    {
      "field": "month",
      "value": "*",
      "description": "every month"
    },
    {
      "field": "day of week",
      "value": "SUN",
      "description": "Sunday"
    }
  ]
}
```

Turning on `seconds` prepends a leading `0` to a plain 5-field expression, which is handy when a scheduler (Quartz, some cloud schedulers) requires an explicit seconds field but you only care about minute-level timing:

```example
title: add a seconds field to a 5-field expression
input: 30 9 * * 1-5
params: {"seconds": true, "format": "json"}
output:
{
  "expression": "0 30 9 * * 1-5",
  "description": "At 09:30, Monday through Friday",
  "fields": [
    {
      "field": "second",
      "value": "0",
      "description": "second 0"
    },
    {
      "field": "minute",
      "value": "30",
      "description": "minute 30"
    },
    {
      "field": "hour",
      "value": "9",
      "description": "hour 9"
    },
    {
      "field": "day of month",
      "value": "*",
      "description": "every day of the month"
    },
    {
      "field": "month",
      "value": "*",
      "description": "every month"
    },
    {
      "field": "day of week",
      "value": "1-5",
      "description": "Monday through Friday"
    }
  ]
}
```

## Options

- **output**: `text` (a sentence plus the field table) or `json` (a structured `{ expression, description, fields }` object).
- **locale**: the language of the overall sentence: `en`, `es`, `fr`, `de`, `it`, `nl` or `pt_BR`. The field-by-field breakdown always stays in English regardless of locale.
- **verbose wording**: expands the sentence with more detail, for example turning "Every 5 minutes" into "Every 5 minutes, every hour, every day".
- **24-hour clock**: on by default (`09:30`); turn it off for 12-hour times with AM/PM (`09:30 AM`).
- **weekday index starts at 0 (Sunday)**: on by default, matching classic cron where `0` and `7` both mean Sunday. Turn it off to read weekday numbers the Quartz way, 1-based from Sunday (1 = Sunday … 7 = Saturday).
- **seconds field**: prepends `0` as a seconds field to a 5-field expression. A 6- or 7-field expression is left untouched.

## Common uses

- Reviewing a `crontab` entry, CI schedule (GitHub Actions `on: schedule`, GitLab CI) or Kubernetes `CronJob` before deploying it.
- Documenting what a scheduled job does in plain language for a runbook or PR description.
- Debugging "why didn't this job run" by confirming which days and hours an expression actually covers.
- Feeding the JSON breakdown into another tool or script that needs the parsed fields rather than free text.

## Tips and pitfalls

- An expression needs 5 to 7 space-separated fields; anything outside that range, or a value cronstrue can't parse (like a minute above 59), throws a clear error naming the offending expression.
- With a 6-field expression, whether the first field is seconds or minutes is genuinely ambiguous. This tool follows cronstrue's own rule: a trailing 4-digit year, or a `?` as the third or fifth field (the day-of-month and day-of-week slots of a minute-first reading), means the expression has no seconds field. A Quartz expression such as `0 30 9 ? * MON-FRI` still reads seconds-first, because its `?` is the fourth field.
- The sentence and the table are generated independently (cronstrue for the sentence, this tool's own logic for each field), so if you ever see them disagree on a weekday or month name, that is a bug worth reporting rather than a quirk to work around.
- This tool describes a schedule; it does not compute next run times. If your scheduler logs run times as Unix timestamps, [timestamp convert](/util/timestamp_convert/) or [date format](/util/date_format/) turns them into readable dates, and [humanize duration](/util/duration_humanize/) turns an interval in seconds into words.
