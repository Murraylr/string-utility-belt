---
title: JSONPath Query Tool Online: Filter & Extract JSON
description: Query JSON online with JSONPath (wildcards, recursive descent, slices, unions and filter expressions) and get matching values, paths or a count.
---
## What is JSONPath?

JSONPath is to JSON what a simple XPath is to XML: a compact expression language for picking out one or more values from a document by describing where they live, rather than writing code to walk the structure by hand. `$.store.book[0].title` reads as "from the root, into `store`, into `book`, the first element, its `title`." This tool implements a practical JSONPath subset directly against your JSON input: child access, wildcards, recursive descent, array slices, unions and filter expressions.

## How it works

A path starts at `$`, the root (a leading `$` may be omitted), and each segment narrows the selection. Plain dotted access reaches into an object, and a wildcard fans out over an array:

```example
title: wildcard over an array, pulling one field from each
params: {"path": "$.store.book[*].author", "indent": 0}
input: {"store":{"book":[{"author":"Nigel Rees","price":8.95},{"author":"Evelyn Waugh","price":12.99}]}}
output: ["Nigel Rees","Evelyn Waugh"]
```

`[*]` (or `.*`) is the wildcard: it matches every element of an array or every value of an object. `..` before a segment is recursive descent: it searches at every depth, not just the immediate children:

```example
title: recursive descent finds a key at any depth
params: {"path": "$..price", "indent": 0}
input: {"store":{"book":[{"price":8.95},{"price":12.99}],"bicycle":{"price":19.95}}}
output: [8.95,12.99,19.95]
```

Array access supports a plain index (negative counts from the end), a Python-style slice `start:end:step`, and a comma-separated union of indices or names:

```example
title: a negative index counts from the end
params: {"path": "$.a[-1]", "indent": 0}
input: {"a":[10,20,30]}
output: [30]
```

### Filter expressions

A filter, written `[?(...)]`, keeps only the array elements (or object values) satisfying a boolean test against `@`, the current element. Comparisons support `==`, `!=`, `<`, `<=`, `>`, `>=`, the regex operator `=~`, and `&&` / `||` / `!` for combining them:

```example
title: filter an array of objects by a numeric comparison
params: {"path": "$..book[?(@.price < 10)].title", "indent": 0}
input: {"book":[{"title":"A","price":8},{"title":"B","price":22}]}
output: ["A"]
```

A bare path with no comparison, like `[?(@.isbn)]`, is an existence test: it keeps elements where that property is present and not `null`. Inside a filter, `$` still refers to the whole document's root, so you can compare a field against another part of the document, not just a literal.

### Result modes

**Result** controls the shape of the output: `values` (default) returns the matched values as a JSON array; `paths` returns each match's own JSONPath location instead; `first` returns just the first match, unwrapped to a plain string if it's a string; and `count` returns how many nodes matched:

```example
title: count matches instead of listing them
params: {"path": "$.store.book[*].price", "mode": "count"}
input: {"store":{"book":[{"price":8},{"price":22}]}}
output: 2
```

## Options

- **path**: the JSONPath expression to evaluate (default `$`, the whole document).
- **result**: `values` (default), `paths`, `first` or `count`.
- **indent**: spaces of indentation for `values`/`paths`/`first` output that is itself JSON, 0 to 10 (default 2). Ignored by `count`, and by a `first` result that is a plain string.

## Common uses

- Pulling a specific field, or every occurrence of a field at any depth, out of a large API response or log entry.
- Filtering an array of records down to the ones matching a condition, without writing a loop.
- Checking how many items in a document match a rule, as a quick data-quality check.
- Extracting a value to hand off to a string-focused pipeline step, using `first` mode to avoid the surrounding array and quotes.

## Tips and pitfalls

- A path or filter that matches nothing is not an error. It returns an empty array (`[]`), a count of `0`, or an empty string for `first`, so a pipeline can keep flowing.
- Writing `[?(price)]` instead of `[?(@.price)]` is a common mistake this tool rejects outright with a clear error, since a bare word left unqualified would otherwise silently match every element.
- `.length` on a string (`$.name.length`) counts Unicode code points, not UTF-16 units, so an emoji such as 😀 counts as one character (a multi-code-point sequence such as a flag still counts as several). On an array, `.length` is its element count.
- For a full structural comparison between two documents rather than a query into one, use [json diff](/util/json_diff/); to reshape the matched values afterward, pipe them into [json pretty](/util/json_pretty/) or [json flatten](/util/json_flatten/).
