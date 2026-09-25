---
title: JSON to XML Converter Online — Convert JSON to XML
description: Convert JSON to XML online with control over the root element, attribute prefix, array item name, indent width and XML declaration.
---
## What is JSON to XML conversion?

XML has no single, universal way to represent JSON's objects and arrays — a JSON key could become an XML element or an attribute, and an array could become repeated siblings or a wrapper element full of items. This tool picks one specific convention, the same one [xml to json](/util/xml_to_json/) reads, so that a simple XML document turned into JSON by that tool converts back to the same XML (comments, CDATA markers and mixed-content text positions are not kept). The reverse trip is not exact: XML text has no types, so numbers, booleans and `null` come back from xml to json as strings (`"1"`, `"true"`, `""`), and a one-item array comes back as a single value.

## How it works

By default, a key whose name starts with `@` becomes an XML attribute instead of a child element, and the special key `#text` becomes an element's text content:

```example
title: single top-level key becomes the root, @attr prefix
input: {"note":{"@id":"1","to":"Tove","from":"Jani"}}
output: <?xml version="1.0" encoding="UTF-8"?>
<note id="1">
  <to>Tove</to>
  <from>Jani</from>
</note>
```

Notice the root element is named `note`, not `root`: when the whole document is a single-key object, that key names the root element automatically. Set **root element** to anything other than its default (`root`) to override this and always wrap the document in that name instead.

An array in a property position produces one sibling element per item, using the same key name each time:

```example
title: an array produces repeated sibling elements
params: {"declaration": false}
input: {"a":1,"b":[1,2]}
output: <root>
  <a>1</a>
  <b>1</b>
  <b>2</b>
</root>
```

An array of arrays has no key to repeat at the inner level, so those items become `<item>` elements (configurable via **array item element**) instead. The same happens to the items of a top-level array:

```example
title: nested array items become item elements
params: {"declaration": false}
input: {"a":{"b":[[1,2],[3]]}}
output: <a>
  <b>
    <item>1</item>
    <item>2</item>
  </b>
  <b>
    <item>3</item>
  </b>
</a>
```

Turn off **xml declaration** to get just the element tree, and note that booleans and numbers are written as plain text:

```example
title: no xml declaration
params: {"declaration": false}
input: {"config":{"debug":true,"retries":3}}
output: <config>
  <debug>true</debug>
  <retries>3</retries>
</config>
```

```example
title: null becomes a self-closing element
params: {"declaration": false}
input: {"a":null}
output: <a/>
```

Keys that are not legal XML names are sanitized automatically: spaces and punctuation become `_` (`first name` → `first_name`), and a name that does not start with a letter, `_` or `:` gets a `_` prefix (`2nd` → `_2nd`). `<`, `>` and `&` are escaped in text and attribute values, as are `"`, tabs and newlines inside attribute values, and a carriage return is written as `&#13;` so it survives being re-parsed instead of being silently normalized to a plain line feed.

## Options

- **root element** — the wrapping element name, `root` by default. It is used when the document is not a single-key object (or that key holds an array); set it to anything other than `root` and it wraps the document even when there is a single key.
- **array item element** — the element name used for array items that have no property key to repeat, such as items of a nested array. Defaults to `item`.
- **indent (0 = single line)** — spaces per nesting level, from 0 to 16. `0` renders everything on one line with no whitespace between tags.
- **attribute prefix** — the key prefix that marks a property as an XML attribute rather than a child element. Defaults to `@`; set it to something else (such as `$`) to change which keys become attributes, or leave it empty to write every key as a child element.
- **xml declaration** — whether to prepend `<?xml version="1.0" encoding="UTF-8"?>`. On by default.

## Common uses

- Producing XML payloads for legacy SOAP APIs or config formats from JSON data.
- Converting a JSON fixture into an XML test case, and reading it back with [xml to json](/util/xml_to_json/) to check the structure (values come back as strings).
- Generating RSS/Atom-like feed fragments from structured data.

## Tips and pitfalls

- This tool accepts a string of JSON text or an already-parsed object handed over from a previous pipeline step.
- Empty input (or whitespace only) produces empty output rather than an error.
- To reformat existing XML instead of generating it from JSON, see [xml pretty](/util/xml_pretty/) and [xml minify](/util/xml_minify/).
