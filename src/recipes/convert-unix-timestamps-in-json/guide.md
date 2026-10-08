---
title: Convert Unix Timestamps in JSON to Readable Dates
description: Paste an API response and turn every epoch seconds or milliseconds value into an ISO 8601 date at any depth, leaving the rest of the JSON as it was.
---

## Reading dates in an API response

Most APIs send dates as Unix time: `"created_at": 1790848800` in seconds, or `"ts": 1790848800123` in milliseconds. That is compact and unambiguous for code, and unreadable for a person comparing two orders or checking when a token expires. Converting them one at a time means copying each number into a converter and back, and a response with a page of fifty records has a hundred or more of them, at different depths and under different names.

A find-and-replace over the raw text cannot do it either, because the replacement is not fixed text: every number becomes a different date. This recipe keeps the JSON as JSON, finds every value that looks like a timestamp wherever it sits, converts it, and gives you the response back in its own shape.

## What each step does

[JSON flatten](/util/json_flatten/) turns the document into a single object of paths and values, such as `data[0].created_at` or `[2].ts` for a top-level array. That brings every value, however deeply nested, to the top level, where the next step can visit them one by one. Keys that contain dots or brackets are quoted in the path, so they survive the trip back.

The second step runs [timestamp convert](/util/timestamp_convert/) on each value on its own, set to ISO 8601 in UTC, but only when the value matches a pattern: 10 digits starting with 12 to 19 (seconds) or 13 digits starting the same way (milliseconds), with an optional fraction. Numbers written as strings, such as `"issued_at": "1790848800"`, match too. Everything else, including `null`, short numbers and text, passes through untouched. To see local time instead, change the timezone in step 2 to an IANA name such as `Europe/Paris`, which gives `2026-10-01T12:00:00.000+02:00`, or switch convert to to `sql` or `rfc2822` for those formats.

[JSON unflatten](/util/json_unflatten/) then rebuilds the nesting from the paths, in the original key order.

## What it can mistake for a date

The pattern looks only at the value, never at its key, so it covers the years 2008 to 2033: from 2008-01-10 (`1200000000`) to 2033-05-18 (`1999999999`). Anything else of that shape is converted too:

- money in micros, such as a Google Ads `costMicros` of `1500000000` for 1,500 in the account currency;
- byte counts between 1.2 and 2 GB;
- ids of 10 or 13 digits that start with 12 to 19, such as some Google Ads customer ids.

Dates outside that window stay numbers, and so do microseconds (16 digits) and nanoseconds (19 digits). Scan the output for fields that should not have turned into dates, and fix those by hand or leave them out of what you paste.

Integers larger than 2^53 (about 9 × 10^15) cannot be held exactly by JavaScript, so a 19-digit id comes back rounded, `1712345678901234567` as `1712345678901234700`. APIs that send such ids usually include a string copy (`id_str` and similar); read that one.

## Input it cannot read

The input has to be one JSON document. JSON Lines (one object per line), `curl -i` output with the HTTP headers on top, JSON with comments or trailing commas, and a Python dict printed with single quotes and `True` all stop at the first step with "invalid JSON". Copy only the body, or convert it first. A field whose value is a JSON document stored as a string keeps its timestamps unconverted: decode it with the [unescape stringified JSON](/recipes/unescape-stringified-json/) recipe, then run this one.

One run converts at most 100,000 values. A larger response stops at step 2 with a message saying how many it has: split it, or use jq.

## The same in jq

`jq 'walk(if type == "number" and . >= 1200000000 and . < 2000000000 then todate elif type == "number" and . >= 1200000000000 and . < 2000000000000 then (. / 1000 | todate) else . end)'` does the same for numbers, with no size limit, but drops the milliseconds and leaves timestamps written as strings alone.
