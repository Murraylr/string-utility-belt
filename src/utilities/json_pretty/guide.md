---
title: JSON Pretty Print Online: Format & Indent JSON
description: Format and indent JSON online for readability, with a configurable indent width from 0 to 10 spaces, by parsing then re-printing the document.
---
## What does pretty-printing JSON do?

Compact JSON (the kind an API returns or a log line records) packs everything onto one line, which is efficient to transmit but hard for a person to scan. Pretty-printing parses that JSON and re-prints it with line breaks and indentation, so nested objects and arrays are visually indented one level per depth. Because it goes through a real parser first, it also confirms the input is valid JSON, and normalizes any inconsistent spacing in the source into one consistent style.

## How it works

The input is parsed, then serialized again with the chosen number of spaces per indent level:

```example
title: default 2-space indent
input: {"a":1,"b":[1,2,3]}
output:
{
  "a": 1,
  "b": [
    1,
    2,
    3
  ]
}
```

Every object and array gets its own line per member, with the closing brace or bracket aligned to the line that opened it. Object keys keep the order they appear in the source, except that JavaScript moves integer-like keys (`"2"`, `"10"`) to the front of their object in ascending numeric order; pretty-printing never sorts the other keys. Use [json sort keys](/util/json_sort_keys/) if you also want alphabetical ordering.

### Choosing the indent width

**Indent** accepts any whole number from 0 to 10. A larger number spaces nested levels further apart, which can help when a document is deeply nested:

```example
title: 4-space indent
params: {"indent": 4}
input: {"a":1}
output:
{
    "a": 1
}
```

An indent of `0` produces no line breaks at all: the same single-line output as [json minify](/util/json_minify/).

An empty input (or one that's only whitespace) returns an empty string instead of an error, so a pipeline doesn't complain about a JSON step that hasn't received data yet. Anything else that fails to parse (an unquoted key, a trailing comma, an unterminated string) throws the underlying parser's error message; run [json validate](/util/json_validate/) first if you need the exact line and column of the problem, or [json5 / jsonc parse](/util/json5_parse/) if the source allows comments or trailing commas.

## Options

- **indent**: number of spaces per nesting level, a whole number from 0 to 10 (default 2). A fractional or out-of-range value is rejected as a step error.

## Common uses

- Reading an API response, a log line, or a minified config file without squinting at one long line.
- Turning a compact JSON payload into a diffable, line-per-value format before comparing it in version control.
- Preparing JSON for a code review or documentation example, where indentation makes structure obvious.
- A quick sanity check that a JSON document parses at all, since malformed input throws immediately.

## Tips and pitfalls

- Numbers are re-printed in JavaScript's canonical form: `1.50` becomes `1.5` and `1e2` becomes `100`, because the value is round-tripped through a real number, not preserved as text.
- Very large integers that exceed JavaScript's safe integer range can lose precision during parsing, the same limitation every JSON.parse-based tool has; keep such ids as strings in the source if exact precision matters.
- To go back to a single compact line, use [json minify](/util/json_minify/); to alphabetize keys as well as indent them, use [json sort keys](/util/json_sort_keys/).
- For JSON5 or JSONC input (comments, trailing commas, unquoted keys), parse it with [json5 / jsonc parse](/util/json5_parse/) first, which also lets you choose the output indent.
