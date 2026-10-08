---
title: JSON to TOML Converter: Convert JSON to TOML Online
description: Convert JSON objects to TOML online. See how nested objects become tables, object arrays become array-of-tables, and why null values are rejected.
---
## What is TOML?

TOML (Tom's Obvious, Minimal Language) is a configuration file format built to be easy for humans to read and unambiguous for a parser to interpret. It backs tools such as Cargo (Rust), Poetry and Hatch (`pyproject.toml`), and countless app config files. Where JSON nests objects in braces, TOML usually writes a nested object as a table introduced by a `[section]` header, with its values as `key = value` lines underneath. This tool takes a JSON document and writes the equivalent TOML, so you can hand-edit a config that started life as JSON, or feed a JSON API response into a TOML-only tool. [toml to json](/util/toml_to_json/) does the reverse conversion.

## How the conversion works

A JSON object's top-level keys become TOML key-value pairs or table headers:

1. Scalars (strings, numbers, booleans) at the top level become plain `key = value` lines.
2. An array of scalars becomes an inline array, `tags = [ "cli", "text" ]`.
3. A nested object becomes a `[section]` table, with its own keys underneath.
4. An array of objects becomes an array-of-tables, written as repeated `[[section]]` blocks, one per array entry.

TOML requires every bare key-value pair to appear before the first table header in a document, so the converter reorders scalar keys ahead of any `[section]` or `[[section]]` blocks it emits, even if they came later in the source JSON.

```example
title: scalars and an array
input: {"title":"belt","port":8080,"tags":["cli","text"]}
output:
title = "belt"
port = 8080
tags = [ "cli", "text" ]

```

```example
title: a nested object becomes a table
input: {"owner":{"name":"Ann","active":true}}
output:
[owner]
name = "Ann"
active = true

```

```example
title: an array of objects becomes an array of tables
input: {"x":[{"a":1},{"a":2}]}
output:
[[x]]
a = 1

[[x]]
a = 2

```

Keys that are not valid bare TOML identifiers (including any non-ASCII key) are automatically quoted:

```example
title: non-ascii keys are quoted
input: {"ключ":"café 😀"}
output:
"ключ" = "café 😀"

```

## Null values and other limits

TOML has no `null` literal, so this tool refuses to silently drop a null-valued key. It raises an error naming the exact path (for example `"user.email" is null`) instead of producing a document that quietly lost data. Drop the key or give it a real value before converting. The source document must also be a JSON object at the top level; a bare array, string, number or `null` has no table to attach to and is rejected. An empty object (`{}`) produces an empty document rather than a stray blank line. Parsed JSON does not keep `1.0` apart from `1`, so a whole-number float is written as a TOML integer (`x = 1`), and a date-like string stays a quoted string rather than becoming a TOML datetime.

## Common uses

- Migrating a JSON config file to a TOML-based tool. The structure converts as-is; key names are not mapped between formats, so moving settings into a `pyproject.toml` or `Cargo.toml` still means renaming keys to what that tool expects.
- Turning an API response into a human-editable config snippet.
- Round-tripping test fixtures between JSON and TOML for tools that only accept one format.

## Tips and pitfalls

- Run [json validate](/util/json_validate/) first if you are not sure the input is well-formed JSON. This tool reports invalid JSON with the underlying parser's message.
- If you need YAML instead, see [json to yaml](/util/json_to_yaml/), which does allow `null`.
- For a quick look at nested JSON structure before converting, [json pretty](/util/json_pretty/) is a useful first step.
