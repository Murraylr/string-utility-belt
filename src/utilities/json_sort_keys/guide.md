---
title: Sort JSON Keys Online: Alphabetize JSON Objects
description: Sort JSON object keys alphabetically online, ascending or descending, at every depth or just the root, with optional array sorting too.
---
## Why sort JSON keys?

JSON objects are unordered by specification (`{"a":1,"b":2}` and `{"b":2,"a":1}` mean exactly the same thing), but tools that compare or hash JSON text usually care about the literal bytes. Sorting keys into a consistent order turns two semantically-equal documents into byte-identical ones, which is why it's a standard step before diffing configuration files, computing a stable hash of a JSON payload, or making generated output deterministic between runs.

## How it works

By default, every object's keys are sorted alphabetically at every level of nesting:

```example
title: sorts every depth (the default)
input: {"banana":1,"apple":2,"cherry":{"z":1,"a":2}}
output:
{
  "apple": 2,
  "banana": 1,
  "cherry": {
    "a": 2,
    "z": 1
  }
}
```

Only object keys are reordered by default. Array elements keep their original order and position, since reordering them would usually change the data's meaning (see below for the opt-in exception).

### Ascending or descending

**Direction** flips the comparison:

```example
title: descending order
params: {"direction": "desc", "indent": 0}
input: {"banana":1,"apple":2,"cherry":3}
output: {"cherry":3,"banana":1,"apple":2}
```

### Root only vs. every depth

**Sort nested values** (on by default) controls whether the sort recurses into nested objects and arrays, or only touches the top-level object:

```example
title: only the root is sorted when deep is off
params: {"deep": false, "indent": 0}
input: {"b":{"d":1,"c":2},"a":3}
output: {"a":3,"b":{"d":1,"c":2}}
```

Notice `b`'s own keys (`d`, `c`) keep their original order. Only the root's keys, `a` and `b`, were reordered.

### Sorting array elements too

Turning on **sort array elements** additionally sorts the members of every array by value, using a total order across JSON's types: `null` < `false`/`true` < numbers < strings < arrays < objects, with `false` before `true`, numbers compared numerically, strings by code point, and arrays or objects by their compact JSON text:

```example
title: sort array elements by value
params: {"sortArrays": true, "indent": 0}
input: {"a":[3,1,2]}
output: {"a":[1,2,3]}
```

This total order is what makes sorting meaningful even for a mixed array of different types, though sorting an array does change its order and is only safe when that order isn't semantically significant.

## Options

- **direction**: `asc` (default) or `desc`.
- **sort nested values**: on by default; when off, only the root's own keys (or, with array sorting on, a root array's elements) are reordered and everything beneath keeps its original order, apart from JavaScript's parser moving integer-like keys such as `"2"` to the front of a nested object.
- **sort array elements**: off by default; see above.
- **indent**: spaces of indentation in the printed JSON, 0 to 10 (default 2).

## Common uses

- Producing a canonical form of a JSON document for hashing, checksums, or content-addressed storage.
- Making config files and generated JSON diff-friendly in version control, so a diff only shows real changes rather than reordered keys.
- Comparing two API responses for equality regardless of key order. Pair with [json diff](/util/json_diff/) for a full structural comparison instead of just a text diff.
- Alphabetizing a large hand-written JSON object for easier scanning, ahead of [json pretty](/util/json_pretty/) for final formatting.

## Tips and pitfalls

- Keys are compared by Unicode code point, so uppercase letters sort before lowercase (`"Zebra"` before `"apple"`), and not by the JavaScript engine's default object key ordering. So integer-like keys such as `"2"` and `"10"` sort as text (`"10"` before `"2"`), matching what you'd get from a real string sort rather than JavaScript's automatic numeric-key reordering.
- Sorting is purely about key and (optionally) array order; it never adds or removes keys. Values do go through `JSON.parse`, though, so numbers come out in JavaScript's canonical form (`1.50` becomes `1.5`), integers beyond 2^53 can lose precision, and a duplicated key keeps only its last value.
- If your goal is only to get readable indentation without reordering anything, use [json pretty](/util/json_pretty/) instead.
- Invalid JSON input throws a parse error rather than attempting a partial sort. Run [json validate](/util/json_validate/) if you need the line and column of the problem.
