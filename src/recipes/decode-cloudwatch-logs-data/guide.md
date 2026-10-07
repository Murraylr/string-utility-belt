---
title: Decode CloudWatch Logs awslogs.data to Readable Log Lines
description: Paste a Lambda awslogs event, a Kinesis or Firehose record or the bare data value and read the gzipped CloudWatch Logs events as plain log lines.
---

## What a subscription filter actually sends

A CloudWatch Logs subscription filter does not hand its destination plain log lines. A Lambda function subscribed to a log group receives an event shaped like `{"awslogs": {"data": "H4sI…"}}`: the value of `data` is Base64 text, the Base64 holds a gzip stream, and the gzip holds a JSON document with `messageType`, `owner` (the account ID), `logGroup`, `logStream`, `subscriptionFilters` and a `logEvents` array, each event carrying an `id`, a `timestamp` in epoch milliseconds and the `message`. Kinesis Data Streams and Amazon Data Firehose destinations receive the same gzipped JSON as each record's data, and a Lambda function that consumes the stream, or transforms the Firehose records, gets it Base64-encoded. The CloudWatch Logs documentation on [subscription filters](https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/SubscriptionFilters.html) describes the format.

Each layer stops a different single tool. A Base64 decoder turns the value into binary starting with the gzip header bytes `1f 8b 08`, which is why every one of these values begins with `H4sI`. A gunzip gets you to the JSON, but on one line and with every message still a JSON string: tabs as `\t`, quotes as `\"` and the newline that ends most Lambda log lines as `\n`. A JSON formatter indents the envelope and leaves the messages escaped. Reading the lines as your function wrote them takes all of those steps, in a particular order.

## What each step does, and why the order matters

The first [jsonpath query](/util/jsonpath/) takes `$..['data','Data']`, the first field with either name at any depth: `awslogs.data` in a subscription event, `Records[0].kinesis.data` in a Lambda event from a Kinesis stream, `records[0].data` in a Firehose transformation event, `Records[0].Data` in `aws kinesis get-records` output. It runs only when the input starts with `{`, so a bare Base64 value skips it.

[gzip decompress](/util/gzip_decompress/) recognises Base64 text by itself, so the recipe needs no separate Base64 step. A value cut short when you copied it stops here with an error instead of decoding to half a document, and the stream's CRC-32 is checked, so corrupted data is reported rather than turned into wrong text.

The second jsonpath query, `$.logEvents[*].message`, keeps the messages and drops everything else, and [json to jsonl](/util/json_to_jsonl/) writes each one as a JSON string on its own line. In that form a stack trace is still one line with `\n` escapes in it and a quote inside a message is still `\"`, so a closing quote, a line break and an opening quote can only be the seam between two events. The [sed script](/util/sed/) turns each seam into a plain line break and drops the `\n` or `\r` escapes that ended the earlier message, which would otherwise leave a blank line after every event. That leaves one long JSON string for [code string unescape](/util/code_string_unescape/) to decode in JSON mode. Its outer quotes are kept on purpose: the unescape step strips a matching pair from the ends of its input, and would otherwise take a message's own leading and trailing apostrophes. Unescape before joining, and the line breaks and quotes inside messages would look exactly like the ones between them.

## Limits and things to check

- Only the first record is decoded. A Kinesis or Firehose batch can hold many, each with its own gzip payload: to read another, change the first step's path, for example to `$.Records[2].kinesis.data`.
- Log group, log stream, event ids and timestamps are dropped (the gzip step's output shows the whole envelope), and Lambda's START, END and REPORT lines carry no timestamp of their own.
- Paste JSON or the bare value, not a log line. Python's `print(event)` writes a dict with single quotes, Node's `console.log(event)` a JavaScript object literal, and Lambda's Node.js console and Python logging put a timestamp, level and request ID in front. Depending on what you copy, the first step reports "input is not valid JSON" or the gzip step "not valid gzip data". Copy from the opening brace of a logged `json.dumps(event)` or `JSON.stringify(event)`, or only the value between the quotes after `data`.
- An empty result means no `data` or `Data` field was found. JSONPath names are case-sensitive.
- A message that ends in a literal backslash followed by `n` or `r` (two characters, not a line break) is misread as ending in a line-break escape, and the last step stops with an escape error.
- A stream receiving subscription data can also hold records whose `messageType` is `CONTROL_MESSAGE`, which CloudWatch Logs sends mainly to check that the destination is reachable. They decode like any other record but hold no events from your log group, so code that forwards logs should skip them.

## Doing it in a terminal or in code

With the event saved to a file and jq installed, this prints the same lines as the worked example:

```bash
jq -r '.awslogs.data' event.json | base64 --decode | gunzip | jq -r '.logEvents[].message | rtrimstr("\n")'
```

For get-records output, start with `jq -r '.Records[0].Data'` instead; for a bare value, with `printf '%s' "$DATA"`.

Inside a handler, Python decodes the payload with `json.loads(gzip.decompress(base64.b64decode(event["awslogs"]["data"])))` and Node.js with `JSON.parse(zlib.gunzipSync(Buffer.from(event.awslogs.data, "base64")).toString("utf8"))`; either way `logEvents` arrives as a list of objects and the escaping never shows. This recipe is for the moments in between: a payload copied out of a log line, a test event, a record pulled from a stream with the CLI. What you paste is decoded in your browser, not sent anywhere.
