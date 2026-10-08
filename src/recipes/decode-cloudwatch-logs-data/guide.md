---
title: Decode CloudWatch Logs awslogs.data to Readable Log Lines
description: Paste a Lambda awslogs event, a Kinesis or Firehose batch or the bare data value and read the gzipped CloudWatch Logs events as plain log lines.
---

## What a subscription filter actually sends

A CloudWatch Logs subscription filter does not hand its destination plain log lines. A Lambda function subscribed to a log group receives an event shaped like `{"awslogs": {"data": "H4sI…"}}`: the value of `data` is Base64 text, the Base64 holds a gzip stream, and the gzip holds a JSON document with `messageType`, `owner` (the account ID), `logGroup`, `logStream`, `subscriptionFilters` and a `logEvents` array, each event carrying an `id`, a `timestamp` in epoch milliseconds and the `message`. Kinesis Data Streams and Amazon Data Firehose destinations receive the same gzipped JSON as each record's data, and a Lambda function that consumes the stream, or transforms the Firehose records, gets it Base64-encoded. The CloudWatch Logs documentation on [subscription filters](https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/SubscriptionFilters.html) describes the format.

Each layer stops a different single tool. A Base64 decoder turns the value into binary starting with the gzip header bytes `1f 8b 08`, which is why every one of these values begins with `H4sI`. A gunzip gets you to the JSON, but on one line and with every message still a JSON string: tabs as `\t`, quotes as `\"` and the newline that ends most Lambda log lines as `\n`. A JSON formatter indents the envelope and leaves the messages escaped. Reading the lines as your function wrote them takes all of those steps, in a particular order.

## What each step does, and why the order matters

The first step, [regex extract](/util/regex_extract/), pulls out every run of Base64 that starts with `H4sI`, one per line. Every gzip stream starts with the bytes `1f 8b 08`, which Base64 writes as `H4sI`, so one pattern finds `awslogs.data` in a subscription event, the `kinesis.data` of every record in a Lambda event from a Kinesis stream, every `data` in a Firehose transformation event and every `Data` in `aws kinesis get-records` output, without knowing the shape of any of them. Because it never parses the text around the payload, it also finds one inside an event that Python's `print(event)` or Node's `console.log(event)` wrote to the log, with its single quotes and timestamp prefix. A bare value passes through as it is.

The other three steps run on each line on its own, so every record, and later every message, is handled apart from the others. [gzip decompress](/util/gzip_decompress/) recognises Base64 text by itself, so the recipe needs no separate Base64 step. It inflates each gzip stream and checks its CRC-32, so a value cut short when you copied it, or damaged on the way, is reported instead of decoding to wrong text, and the result is the JSON envelope of that record on one line.

Next, a [jsonpath query](/util/jsonpath/) takes `$.logEvents[*].message` from each envelope, and [json to jsonl](/util/json_to_jsonl/) writes every message as a JSON string on a line of its own. In that form a stack trace is still one line with `\n` escapes in it, so the line breaks between messages are the only real ones. The last step relies on that: it runs [code string unescape](/util/code_string_unescape/) in JSON mode on every message, turning `\t`, `\"` and `\n` back into a tab, a quote and a real line break, then [normalize line endings](/util/normalize_line_endings/) drops the line break that ends most Lambda log lines, which would otherwise leave a blank line after every event. Unescape before the messages sit on lines of their own, and the line breaks inside a stack trace would be indistinguishable from the ones between events.

## Limits and things to check

- Log group, log stream, event ids and timestamps are dropped (step 2's output shows the whole envelope of every record), and Lambda's START, END and REPORT lines carry no timestamp of their own.
- A bare value that a terminal or log viewer wrapped across several lines has to be joined into one line first. Otherwise each piece is read as a payload of its own and fails.
- Payloads written with escaped slashes (`\/`, as PHP's `json_encode` and some loggers print JSON) are cut short at the first one. Replace `\/` with `/` before pasting.
- A record that does not decode stays in the output as its line of Base64, and step 2 names the line that failed, so one damaged record never hides the rest of a batch.
- A carriage return inside a message comes out as a line break.
- When nothing you pasted contains `H4sI`, the first step is skipped, step 2 reports every line as not valid gzip data, and the output is your input back (or nothing, for JSON on a single line). That means there was no payload to find, often because only part of the event was copied.
- A stream receiving subscription data can also hold records whose `messageType` is `CONTROL_MESSAGE`, which CloudWatch Logs sends mainly to check that the destination is reachable. They decode like any other record but hold no events from your log group, so code that forwards logs should skip them.

## Doing it in a terminal or in code

With a subscription event saved to a file and jq installed, this prints the same lines as the worked example:

```bash
jq -r '.awslogs.data' event.json | base64 --decode | gunzip | jq -r '.logEvents[].message | rtrimstr("\n")'
```

A batch carries one gzip payload per record, and a record's Base64 can end in `=` padding, so the values cannot be joined and decoded as one. Decode each record on its own:

```bash
jq -r '.Records[].kinesis.data' event.json | while read -r data; do printf '%s' "$data" | base64 --decode | gunzip; done | jq -r '.logEvents[].message | rtrimstr("\n")'
```

For get-records output, start with `jq -r '.Records[].Data'`, for a Firehose transformation event with `jq -r '.records[].data'`, and for a bare value with `printf '%s' "$DATA"`.

Inside a handler, Python decodes one payload with `json.loads(gzip.decompress(base64.b64decode(event["awslogs"]["data"])))` and Node.js with `JSON.parse(zlib.gunzipSync(Buffer.from(event.awslogs.data, "base64")).toString("utf8"))`; for a Kinesis batch, loop over `event["Records"]` and decode each `kinesis.data` the same way. Either way `logEvents` arrives as a list of objects and the escaping never shows. This recipe is for the moments in between: a payload copied out of a log line, a test event, a batch pulled from a stream with the CLI. What you paste is decoded in your browser, not sent anywhere.
