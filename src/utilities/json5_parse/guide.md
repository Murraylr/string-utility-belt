---
title: JSON5 / JSONC Parser Online — Convert to Strict JSON
description: Parse JSON5 or JSONC online — comments, trailing commas, single quotes, unquoted keys — into strict, valid JSON at your chosen indent.
---
## What are JSON5 and JSONC?

Strict JSON (RFC 8259) is deliberately minimal: no comments, no trailing commas, keys must be double-quoted. That's fine for machine-to-machine data, but awkward for anything a person hand-edits, like a config file. JSON5 and JSONC are two popular supersets that relax those rules while staying easy to convert back to plain JSON. JSONC (JSON with Comments, used by VS Code's `settings.json` and `tsconfig.json`) adds comments and trailing commas; JSON5 goes further, also allowing single-quoted strings, unquoted object keys, and a few extra number forms. This tool reads either dialect and produces the strict JSON equivalent.

## How it works

The parser is a real recursive-descent reader, not a regex that strips `//` from the text — a naive strip would corrupt a string that happens to contain `//` or a comma. It parses the document structurally, so it can safely re-emit clean JSON:

```example
title: comments, a trailing comma, unquoted keys and single quotes
input:
{
  // a comment
  id: 1,
  name: 'Ada',
  tags: [1, 2,],
}
output:
{
  "id": 1,
  "name": "Ada",
  "tags": [
    1,
    2
  ]
}
```

Both `//` line comments and `/* */` block comments are recognized anywhere whitespace is allowed. Object keys may be double-quoted, single-quoted, or bare identifiers (`id:` instead of `"id":`); string values may use either quote style, with the usual backslash escapes plus a two-digit `\xNN` escape. Trailing commas are allowed after the last item of an array or object.

### Numbers

JSON5 accepts a few number forms strict JSON doesn't: a leading `+` sign, a leading or trailing decimal point (`.5`, `5.`), hexadecimal literals (`0x1F`), and the special values `Infinity` and `NaN`. The first three are converted to ordinary decimal numbers; `Infinity`, `-Infinity` and `NaN` have no strict-JSON form, so they come out as `null`. A leading zero followed by another digit (`010`) is rejected as ambiguous with a legacy octal literal, in both JSON and JSON5.

### Choosing the output indent

The output is printed with the chosen indent; `0` gives compact, single-line JSON:

```example
title: indent 0 prints compact JSON
params: {"indent": 0}
input: {a: [1, 2,], b: 'x'}
output: {"a":[1,2],"b":"x"}
```

## Options

- **indent** — spaces of indentation in the printed JSON, 0 to 10 (default 2).

## Common uses

- Converting a hand-written `.jsonc` config file (VS Code settings, `tsconfig.json`) into plain JSON for a tool that only accepts strict JSON.
- Cleaning up JSON5 test fixtures or sample data before feeding them into a strict JSON pipeline step.
- Reading JavaScript-object-literal-flavored data — the kind pasted straight from source code — where keys aren't quoted and trailing commas are common.
- A safer alternative to hand-stripping comments with a text editor's find-and-replace, which breaks on `//` or a comma inside a string.

## Tips and pitfalls

- This tool converts; it does not merely check syntax. If you only want to know whether input is valid JSON5/JSONC without converting it, turn off strict mode in [json validate](/util/json_validate/) instead, which reports the line and column of any problem.
- `\u{...}` code-point escapes (valid in modern JavaScript strings) are explicitly rejected — JSON5 only defines the four-hex-digit `\uXXXX` form.
- A `__proto__` key in the source is preserved as an ordinary data key in the output; it can never silently redefine the resulting object's prototype.
- Once you have strict JSON, [json pretty](/util/json_pretty/) and [json minify](/util/json_minify/) both handle further reformatting, and [json validate](/util/json_validate/) can confirm the result is fully RFC 8259 compliant.
