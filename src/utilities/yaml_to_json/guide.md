---
title: YAML to JSON Converter Online: Parse YAML to JSON
description: Convert YAML to JSON online with a configurable indent. Handles multi-document streams, anchors and aliases, and reports circular references.
---
## What is YAML to JSON conversion?

YAML is the format behind Kubernetes manifests, Ansible playbooks, GitHub Actions workflows and many app config files, but most programs that consume config at runtime want plain JSON. This tool parses YAML text and re-emits it as JSON, so you can validate a Kubernetes manifest against a JSON Schema, read a config value from JavaScript, or just see a YAML document's structure more clearly. [json to yaml](/util/json_to_yaml/) converts back the other way.

## How it works

YAML mappings become JSON objects, sequences become JSON arrays, and scalars keep their type. Strings, numbers, booleans and `null` all convert directly:

```example
title: a mapping becomes an object
input: name: Ann
age: 30
output: {
  "name": "Ann",
  "age": 30
}
```

YAML text can also be a stream of several documents separated by `---`. A single document unwraps to its own value, but a stream of more than one always becomes a JSON array, with one entry per document:

```example
title: a multi-document stream becomes an array
params: {"allDocuments": true}
input: ---
a: 1
---
b: 2
output: [
  {
    "a": 1
  },
  {
    "b": 2
  }
]
```

YAML anchors and aliases (`&name` / `*name`) are a way to reuse a value without repeating it in the source text. This tool expands every alias back into a full copy of the anchored value before converting to JSON, since JSON has no way to express "the same value as over there":

```example
title: an alias expands to a full copy of the anchored value
params: {"indent": 0}
input: base: &b
  x: 1
copy: *b
output: {"base":{"x":1},"copy":{"x":1}}
```

An anchor that refers to itself, directly or through another anchor, creates a circular structure that JSON cannot represent at all. That raises an error explaining the cycle rather than hanging or truncating the output.

## Options

- **indent (0 = minified)**: the number of spaces used to pretty-print the JSON, from 0 to 10. The default is 2; 0 produces compact, single-line JSON.
- **always emit an array of documents**: when on, even a single YAML document is wrapped in a one-element array, so downstream code can always expect an array. A stream of several documents is already an array regardless of this setting. Off by default.

## Common uses

- Validating a Kubernetes manifest or Helm values file against a JSON Schema with [json schema validate](/util/json_schema_validate/).
- Reading a CI config (GitHub Actions, GitLab CI) or Ansible playbook value from JavaScript tooling.
- Converting YAML test fixtures to JSON for tools that only accept JSON.

## Tips and pitfalls

- A document that contains only comments parses to `null`, not an error or an empty object; empty input gives empty output.
- The parser follows YAML 1.2: `yes`, `no`, `on` and `off` stay strings (YAML 1.1 read them as booleans), `014` is decimal 14, and a date such as `2001-12-14` stays a string.
- YAML 1.2 dropped the `<<` merge key, so `<<: *defaults` (common in Docker Compose and GitLab CI files) is not merged: it comes through as a literal `"<<"` key holding the anchored value.
- Duplicate keys in one mapping are an error, not a silent last-one-wins.
- Malformed YAML (bad indentation, an unterminated flow sequence) is reported with the underlying parser's message so you can find the offending line.
- Integers beyond JavaScript's safe range (2^53 − 1) lose precision, just as they do in `JSON.parse`.
