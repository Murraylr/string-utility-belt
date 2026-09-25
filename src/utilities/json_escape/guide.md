---
title: JSON String Escape — Escape Text for JSON Online
description: Escape a string for safe inclusion inside a JSON string literal — quotes, backslashes, control characters and newlines.
---
## What does escaping a string for JSON mean?

JSON string literals are delimited by double quotes and use backslash escapes for a handful of characters that would otherwise be illegal or ambiguous inside them: the quote character itself, the backslash, and control characters like newline and tab. If you're building a JSON document by hand — hardcoding a value into a config file, embedding a log line as a JSON field, or constructing a payload in a language without a JSON library handy — you need those characters escaped correctly or the result won't parse. This tool takes plain text and returns exactly the escaped body that would sit between the quotes of a JSON string, without the quotes themselves.

Internally, it uses `JSON.stringify` on the input and strips the surrounding quotes it adds, so the escaping is exactly what any JSON parser expects — nothing custom or approximate.

## How it works

Every double quote and backslash is escaped, and the standard control-character shorthands are used where JSON defines one:

```example
title: newlines, tabs and quotes
input:
Line1
Line2	"quoted"
output: Line1\nLine2\t\"quoted\"
```

A literal backslash in the input becomes two backslashes in the output, since a single backslash always introduces an escape sequence in JSON:

```example
title: a literal backslash is doubled
input: a\b
output: a\\b
```

Carriage return and line feed each get their own short escape (`\r`, `\n`) rather than a generic `\u000D` / `\u000A`:

```example
title: carriage return and newline use short escapes
input-encoding: hex
input: 0D0A
output: \r\n
```

Control characters without a short form (U+0000, the escape character U+001B, and so on) become a six-character `\u00XX` escape instead. The forward slash `/` is left alone — JSON allows `\/` but never requires it.

### Non-ASCII text is left alone

Unlike some encoders, this tool does not escape accented letters or other non-ASCII characters as `\uXXXX`. RFC 8259 only requires `"`, `\` and the control characters U+0000–U+001F to be escaped; every other character may appear literally in a JSON string, so `JSON.stringify` (and this tool) leaves them alone:

```example
title: non-ASCII text is left as literal UTF-8, not escaped
input: café 日本語
output: café 日本語
```

If you specifically need `\uXXXX` escapes for non-ASCII characters — for compatibility with a system that only accepts ASCII JSON — use [code string escape](/util/code_string_escape/) with the `json` language and its **escape non-ascii** option turned on: it applies the same JSON rules and writes astral characters as surrogate pairs. ([Unicode escape](/util/unicode_escape_encode/) is not a substitute here — it leaves `"` and control characters unescaped.)

## Common uses

- Hardcoding a dynamic value (a file path, a user comment, a log line) into a JSON literal in code, a config file, or a curl command.
- Preparing text to paste directly into a `.json` file or an API request body.
- Escaping a string for a JSON field when you don't have a JSON library available to do it for you.
- Debugging why hand-written JSON fails to parse, by seeing exactly which characters need escaping.

## Tips and pitfalls

- The output does not include the surrounding double quotes — wrap it yourself (`"` + result + `"`) when building the full literal.
- To reverse this, use [JSON unescape](/util/json_unescape/), which decodes `\n`, `\t`, `\"`, `\\`, `\uXXXX`, and the other JSON escape sequences back to plain text.
- This tool escapes for a JSON *string value*. If you need to produce valid JSON as an object or array (say, from CSV or key-value pairs), that's a different job — see the JSON conversion utilities under Data Formats.
- If your target isn't JSON but a source-code string literal in a specific language (JavaScript, Python, Go, and others), use [code string escape](/util/code_string_escape/) instead — JSON's escaping rules happen to overlap with JavaScript's but not with every language's.
