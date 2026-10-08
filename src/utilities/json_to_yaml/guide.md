---
title: JSON to YAML Converter Online: Convert JSON to YAML
description: Convert JSON to YAML online with a configurable indent, line-wrap width and optional alphabetical key sorting, all explained with worked examples.
---
## What is JSON to YAML conversion?

YAML is a superset of JSON's data model with a lighter-weight syntax: no braces, no trailing commas, and structure shown through indentation instead. It is the format behind Kubernetes manifests, Ansible playbooks, GitHub Actions workflows and countless other config files. Because every JSON value is also valid YAML data, converting JSON to YAML is purely a matter of re-rendering the same structure without the punctuation, so no information is lost. [yaml to json](/util/yaml_to_json/) converts back the other way.

## How it works

The converter walks the parsed JSON value and writes each level as YAML:

- Objects become YAML mappings (`key: value`), one key per line, nested by indentation.
- Arrays become YAML sequences, with a `-` marker per item.
- Numbers, booleans and `null` render as plain YAML scalars. Strings are left unquoted unless they would otherwise read as something else (`"true"`, `"123"`, an empty string or `"x: y"` get quotes), and a string containing newlines becomes a `|-` block.
- Long string values are wrapped onto multiple lines once they exceed the configured line width, continuing on subsequent lines with extra indentation.

```example
title: an object with a nested array
input: {"name":"belt","version":"1.2.0","tags":["cli","text"]}
output:
name: belt
version: 1.2.0
tags:
  - cli
  - text

```

```example
title: a four-space indent
params: {"indent": 4}
input: {"outer":{"inner":1}}
output:
outer:
    inner: 1

```

Long scalar values wrap at the configured line width, continuing on lines indented one level deeper than the key:

```example
title: a long string wraps at the line width
params: {"lineWidth": 20}
input: {"a":"one two three four five six seven"}
output:
a:
  one two three four
  five six seven

```

```example
title: sorting keys alphabetically
params: {"sortKeys": true}
input: {"b":1,"a":{"z":1,"y":2}}
output:
a:
  y: 2
  z: 1
b: 1

```

## Options

- **indent**: the number of spaces per nesting level, from 1 to 12. The default is 2.
- **line width (0 = never wrap)**: the column at which long scalar values wrap onto a new line, from 0 to 100000. The default is 80; set it to 0 to disable wrapping entirely and keep every value on one line.
- **sort keys**: when on, object keys are sorted at every nesting level instead of keeping the order they appeared in the source JSON. The sort compares character codes, so uppercase keys come before lowercase ones (`B`, `_`, `a`, `b`). Off by default.

A top-level JSON array, string, number, `null` or boolean is also accepted and rendered as the equivalent YAML document. A top-level object is not required.

## Common uses

- Turning a JSON API response into a Kubernetes manifest, Docker Compose file or GitHub Actions workflow fragment.
- Converting a `package.json`-style config into a more human-editable YAML config file.
- Preparing test fixtures for tools, like Ansible or Helm, that expect YAML input.

## Tips and pitfalls

- Because JSON has no comments and no anchors, the generated YAML will never contain `&anchor` / `*alias` references. Those only appear when parsing existing YAML that used them, which is what [yaml to json](/util/yaml_to_json/) has to handle on the way back in.
- The output is YAML 1.2, where `yes`, `no`, `on` and `off` are ordinary strings, so they are written unquoted. A YAML 1.1 parser (PyYAML, for one) reads those unquoted words as booleans; quote them by hand if an older tool will consume the file.
- If you need a quick read of the JSON structure first, try [json pretty](/util/json_pretty/).
- For config-file formats other than YAML, see [json to toml](/util/json_to_toml/) and [json to xml](/util/json_to_xml/).
