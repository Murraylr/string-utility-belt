---
title: JSON Minifier Online — Compact JSON, Remove Whitespace
description: Minify JSON online by parsing and re-serializing it with no extra whitespace, shrinking payload size while keeping the same data.
---
## What does minifying JSON do?

Pretty-printed JSON is easier for a person to read, but every space, newline and indent is a byte that a machine doesn't need. Minifying strips all of that formatting down to the minimum punctuation JSON requires — no spaces after `:` or `,`, no line breaks, no indentation — while keeping exactly the same values, keys and structure. It is a genuine parse-and-reserialize step, not a text-based whitespace stripper, so it also validates that the input is actually valid JSON along the way.

## How it works

The input text is parsed with a standard JSON parser and immediately re-serialized with no indentation argument, which produces the most compact valid representation:

```example
title: strip formatting from an indented document
input:
{
  "a": 1,
  "b": [1, 2, 3]
}
output: {"a":1,"b":[1,2,3]}
```

Because this goes through a real parser, the result is also a normalized form: incidental formatting differences between two documents disappear. Two files holding the same data in the same key order but formatted differently will minify to byte-identical output, which makes minified JSON convenient for diffing or hashing when whitespace shouldn't count. Key order is kept as written, with one JavaScript quirk: integer-like keys such as `"2"` or `"10"` are moved to the front of their object in ascending numeric order.

An empty input (or one that is only whitespace) returns an empty string rather than raising a parse error — useful while a pipeline's earlier steps are still catching up as you type:

```example
title: empty input stays empty instead of erroring
input:
output:
```

Anything else that isn't valid JSON, such as an unquoted key or a trailing comma, throws with the underlying parser's error message; use [json validate](/util/json_validate/) if you want a precise line and column instead of just an error.

## Common uses

- Shrinking a JSON payload before sending it over the network or embedding it in a URL or a config file, where every byte counts.
- Normalizing two differently-formatted JSON documents so a diff tool or hash only sees real content changes — see [json diff](/util/json_diff/) for a structural comparison instead.
- Removing accidental extra whitespace introduced by copy-pasting JSON out of a log or a chat message.
- Preparing a compact single-line JSON value to paste into a `.env` file, a shell variable, or a one-line log entry.

## Tips and pitfalls

- Minifying is lossless for data but not for comments: this tool expects strict JSON, so JSON5/JSONC-style `//` comments or trailing commas will fail to parse — run [json5 / jsonc parse](/util/json5_parse/) first if your input has them.
- Minifying does not sort keys: apart from integer-like keys moving to the front, the output keeps the input's key order. Use [json sort keys](/util/json_sort_keys/) if you want a canonical, sorted form as well.
- To go the other direction and get readable, indented JSON back, use [json pretty](/util/json_pretty/) with your preferred indent width.
- Values are re-serialized, not copied as text: numbers come out in JavaScript's canonical form (`1.50` becomes `1.5`, `1e2` becomes `100`), integers beyond 2^53 can lose precision, `A`-style escapes of ordinary characters are written out as the characters themselves, and a duplicated key keeps only its last value.
