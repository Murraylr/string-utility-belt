---
title: JSON Schema Validator Online: Validate JSON Data
description: Validate JSON against a JSON Schema online, checking types, required properties, ranges, patterns and more, with every failure's exact path.
---
## What does validating against a JSON Schema do?

[JSON Validate](/util/json_validate/) checks that text is syntactically valid JSON. This tool checks something stronger: that a JSON *document* actually has the shape you expect (the right fields present, the right types, values within range), as described by a JSON Schema. It implements a practical subset of [draft-07](https://json-schema.org/draft-07/schema): `type`, `properties`, `required`, `items`, `enum`, `const`, string/number/array constraints, `additionalProperties`, the `allOf`/`anyOf`/`oneOf`/`not` combinators, and local `$ref` pointers within the same schema document.

## How it works

Supply the document to validate as the input, and the schema as the **schema** parameter. The result is always `{ valid, errors }`, where every failure names the exact path where it occurred:

```example
title: a document that satisfies its schema
input: {"id":1,"email":"ada@example.com"}
params: {"schema": "{\"type\":\"object\",\"required\":[\"id\",\"email\"],\"properties\":{\"id\":{\"type\":\"integer\"},\"email\":{\"type\":\"string\",\"format\":\"email\"}}}"}
output:
{
  "valid": true,
  "errors": []
}
```

```example
title: a missing property and a wrong type, both reported
input: {"id":"x"}
params: {"schema": "{\"type\":\"object\",\"required\":[\"id\",\"email\"],\"properties\":{\"id\":{\"type\":\"integer\"}}}"}
output:
{
  "valid": false,
  "errors": [
    {
      "path": "$",
      "message": "missing required property \"email\""
    },
    {
      "path": "$.id",
      "message": "expected type integer, got string"
    }
  ]
}
```

Validation doesn't stop at the first problem. Every applicable check runs, so you get the full list of what's wrong in one pass, each tagged with a JSONPath-style `path` pointing at the offending value.

### What gets checked

- **type**: `string`, `number`, `integer` (a whole number), `boolean`, `object`, `array`, `null`, or an array of allowed types.
- **properties** / **required** / **additionalProperties**: per-property sub-schemas, which keys must be present, and whether (or how) extra keys are allowed.
- **items**: either one schema applied to every array element, or an array of schemas applied positionally as a tuple (positions beyond the tuple are unconstrained).
- **String checks**: `minLength`/`maxLength` (counted in Unicode code points), `pattern` (a JavaScript regular expression, unanchored), and `format` (`email`, `uri`, `url`, `uuid`, `date-time`, `ipv4`, each checked with a simple pattern rather than a full parser; any other format name, such as `date`, `hostname` or `ipv6`, is treated as an annotation and always passes).
- **Number checks**: `minimum`, `maximum`, `exclusiveMinimum`, `exclusiveMaximum` (the latter two as numbers, the draft-06+ form; draft-04's boolean form is ignored).
- **Array checks**: `minItems`, `maxItems`, `uniqueItems` (compared by deep value equality, not reference).
- **enum** / **const**: the value must be one of a fixed list, or exactly equal to a fixed value.
- **Combinators**: `allOf` (must match every sub-schema), `anyOf` (at least one), `oneOf` (exactly one), `not` (must not match).
- **$ref**: a local JSON Pointer such as `#/definitions/Address`, resolved within the schema document you supplied. As in draft-07, any other keywords next to a `$ref` are ignored.

```example
title: additionalProperties: false rejects unknown keys
input: {"id":1,"extra":true}
params: {"schema": "{\"type\":\"object\",\"properties\":{\"id\":{\"type\":\"integer\"}},\"additionalProperties\":false}"}
output:
{
  "valid": false,
  "errors": [
    {
      "path": "$.extra",
      "message": "additional property is not allowed"
    }
  ]
}
```

## Options

- **schema**: the JSON Schema to validate against, as JSON text (or loaded from a `.json` file). Left empty, it defaults to `{}`, which every document satisfies.

## Common uses

- Validating an API request or response body against its documented schema before trusting it.
- Checking a config file has all required fields and correctly typed values before deploying it.
- Testing that a schema you're authoring actually rejects the cases you expect it to.
- Enforcing a contract between two systems that exchange JSON, catching shape drift early.

## Tips and pitfalls

- Empty input reports a single error, `no input to validate`, rather than treating "nothing" as trivially valid. An empty schema (`{}`), on the other hand, does accept anything.
- `type: "integer"` specifically requires a whole number; `1.0` passes (it's numerically a whole number) but `1.5` fails.
- A `$ref` can only point within the same schema document you supplied (a `#/...` local pointer); external schema URLs are not fetched.
- Keywords outside the list above (including `multipleOf`, `minProperties`/`maxProperties`, `patternProperties`, `propertyNames`, `dependencies`, `contains`, `additionalItems` and `if`/`then`/`else`) are silently ignored, so a schema that relies on them will accept more than a full validator would.
- If you have a sample document rather than a schema and want one generated automatically, start with [json to json schema](/util/json_to_schema/) and refine the result from there.
