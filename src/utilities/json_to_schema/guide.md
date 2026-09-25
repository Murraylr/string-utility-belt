---
title: JSON to JSON Schema Generator Online
description: Generate a draft-07 JSON Schema from a JSON sample online, inferring types and required fields, with optional example values in the output.
---
## What does this tool do?

Writing a JSON Schema by hand for an existing document is tedious: every field's type has to be spelled out, nested objects need their own sub-schema, and it's easy to miss a field. This tool infers a [draft-07](https://json-schema.org/draft-07/schema) schema directly from a sample JSON document — object shapes, array item types, and primitive types are all worked out automatically — giving you a starting point to refine rather than a blank page. Feed the result into [json schema validate](/util/json_schema_validate/) to check other documents against it.

## How it works

Each value's JSON type becomes a `type` keyword, an object's keys become `properties`, and by default every key found is also listed as `required`:

```example
title: infer a schema from a realistic sample
input: {"id":1,"name":"Ada","tags":["core"],"active":true}
output:
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Root",
  "type": "object",
  "properties": {
    "id": {
      "type": "integer"
    },
    "name": {
      "type": "string"
    },
    "tags": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "active": {
      "type": "boolean"
    }
  },
  "required": [
    "id",
    "name",
    "tags",
    "active"
  ]
}
```

A number with no fractional part becomes `"integer"`; anything else numeric becomes `"number"`. An array's `items` schema is inferred from its own members — if every member has the same shape, all the better, but a mix is handled too (see below).

### Arrays of objects, and required fields that aren't universal

If a sample array's objects don't all have the same keys, **require all properties** only lists the keys present in *every* member as required — a key missing from at least one sample is treated as optional and simply omitted from `required`:

```example
title: only properties present in every array member are required
input: [{"a":1},{"a":2,"b":"x"}]
output:
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Root",
  "type": "array",
  "items": {
    "type": "object",
    "properties": {
      "a": {
        "type": "integer"
      },
      "b": {
        "type": "string"
      }
    },
    "required": [
      "a"
    ]
  }
}
```

Here `a` appears in both array members, so it's required; `b` only appears in the second, so it's left out of `required` entirely rather than being marked optional some other way. A sample that mixes incompatible scalar types — some numbers, some strings — produces `"type": [...]` listing every type seen, since there's no single correct type to pick (integers mixed with fractional numbers simply widen to `"number"`). If objects or arrays are part of the mix, the result is an `anyOf` with one sub-schema per kind instead.

### Titling and requiring

**Title** sets the schema's `title` field, defaulting to `"Root"`; leave it blank to omit `title` entirely. **Require all properties** (on by default) is what adds the `required` array; turning it off produces a schema that only checks shape, not presence:

```example
title: an array sample becomes an array schema with inferred items
params: {"title": "Tags"}
input: ["a","b"]
output:
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Tags",
  "type": "array",
  "items": {
    "type": "string"
  }
}
```

### Keeping sample values as examples

Turning on **include examples** attaches a sampled value to each generated scalar node (strings, numbers, booleans, `null`) under an `examples` array — the first value seen for that type, so an array of many numbers still yields a single example. Object and array nodes get none. It's handy for documentation, though it means the schema now embeds a piece of your real data:

```example
title: sample values kept as examples
params: {"includeExamples": true}
input: {"n": 2}
output:
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Root",
  "type": "object",
  "properties": {
    "n": {
      "type": "integer",
      "examples": [
        2
      ]
    }
  },
  "required": [
    "n"
  ]
}
```

## Options

- **title** — the schema's `title` field (default `Root`); an empty value omits `title` entirely.
- **require all properties** — on by default; lists every property that appears in every sample as `required`.
- **include examples** — off by default; attaches a sampled value as `examples` on each scalar node.

## Common uses

- Bootstrapping a JSON Schema from a real API response or config file instead of writing one from scratch.
- Quickly documenting the shape of data flowing through a pipeline or webhook.
- Generating a starting schema to hand to [json schema validate](/util/json_schema_validate/) for regression-testing future documents against today's shape.
- Comparing the inferred shape of two different sample documents to spot structural drift.

## Tips and pitfalls

- This is inference from one example, not a guarantee: a single sample can't tell the generator about ranges, patterns, formats, or fields that only sometimes appear beyond what an array of samples shows — treat the output as a draft to tighten by hand.
- `null` infers as `"type": "null"`; if a field is sometimes `null` and sometimes another type in an array of samples, the generator merges the two into a `type` array covering both (or into an `anyOf` when the other type is an object or array).
- A `__proto__` key in the sample is preserved as a genuine schema property rather than being lost to JavaScript's prototype chain.
- An empty input produces an empty schema (`{}`) rather than an error, since there's nothing to infer from yet.
