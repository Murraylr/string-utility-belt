---
title: Parse User Agents From an Access Log Into a CSV
description: Paste nginx or Apache access log lines, or a list of user-agent strings, and get one CSV row per line with browser, version, OS, device type and a bot flag.
---

## From raw log lines to a table you can filter

Server logs record every visitor's user agent, the long `Mozilla/5.0 (…) AppleWebKit/537.36 …` string that names the browser, its version, the operating system and sometimes the device. That is what you need to answer which browsers to keep supporting, why errors cluster on one platform, or how much of the traffic is crawlers. Read raw, the strings are almost impossible to compare: every browser claims to be Mozilla, Chrome and Edge both mention Safari, and the version that matters sits in a different place in each.

A user agent parser turns one string into named fields, and that is the catch: it reads one string. Paste a hundred log lines into one and you get a single meaningless result. This recipe pulls the user agent out of each line, parses every line on its own, and writes the results as a CSV that opens in any spreadsheet.

## What each step does

The first step is a [replace](/util/replace/) with a regular expression that recognises the combined log format, the default for Apache and the basis of nginx's: the client address, `[time]`, the quoted request, status and size, the quoted referrer and the quoted user agent. It keeps only the user agent, so a referrer URL is never mistaken for it. It also handles nginx's `main` format with a forwarded-for address after the user agent, a syslog or virtual-host prefix in front of the line, and quotes escaped inside a field. A line that is just a user agent, with or without quotes around it, passes through as it is.

The second step runs [user agent parse](/util/user_agent_parse/), built on ua-parser-js, on each line on its own. Blank lines are parsed too and give an empty row, so the output has exactly one row per input line. [JSONL to JSON](/util/jsonl_to_json/) collects the per-line results into one array, and [JSON to CSV](/util/json_to_csv/) flattens the nested `browser`, `os` and `device` objects into dotted column names and keeps eight of them: browser name and version, OS name and version, device type, vendor and model, and `isBot`. Add or remove names in the last step's columns (comma list), for example `engine.name` or `cpu.architecture`.

## What a user agent can no longer tell you

Browsers now freeze or round parts of the string on purpose, a change known as user-agent reduction, and no parser can recover what is not there. Windows 11 reports itself as Windows 10. Chrome, Edge and Safari on a Mac report macOS 10.15.7 whatever the real version. Chrome on Android reports Android 10 and the model `K`, so phone models and newer Android versions are lost. The precise values are only available through client hints headers, which a plain access log does not record.

`isBot` marks known crawlers such as Googlebot and bingbot, plus command-line clients and libraries like curl and python-requests. A health checker or tool the parser does not know, such as a load balancer probe, gives an empty row with `isBot` false.

## Limits

- Rows match input lines by position only: the CSV has a header row, then row N for line N. Paste it beside the log lines or the user-agent column in your spreadsheet, header in the header row, and each row lines up with its source.
- Only the combined format and bare user agents are recognised. The common log format has no user agent, and its lines give empty rows; JSON logs need the user-agent field extracted first.
- One run handles up to 100,000 lines. Larger logs stop at step 2 with a message saying so: split them, or filter them first with grep.
- To count how often each browser appears rather than list every request, sort the browser column and use [count duplicate lines](/util/uniq_count/), or a pivot table.

On the server itself, `awk -F'"' '{print $6}' access.log` prints the user agent of each combined-format line, ready for `sort | uniq -c`.
