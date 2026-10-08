---
title: XML to JSON Converter Online: Parse XML to JSON
description: Convert XML to JSON online using the popular compact convention, with configurable attribute prefix, text key, and an optional verbose mode.
---
## What is XML to JSON conversion?

XML and JSON model data differently. XML has elements, attributes and mixed text content, while JSON only has objects, arrays and scalars, so there is no single official mapping between them. This tool uses a common "compact" convention: attributes become `@name` keys, an element's text becomes a plain string, and a child element name that repeats becomes an array. [json to xml](/util/json_to_xml/) writes the same convention back out, so a simple document survives the round trip. But comments, CDATA markers, the order of interleaved child elements and the position of text in mixed content are not kept.

## How it works

Parsing walks the XML document with the built-in `DOMParser` and converts each element. Every text and attribute value comes out as a string. XML has no types, so `<age>30</age>` becomes `"30"`, not `30`:

```example
title: attribute + child element
input: <user id="1"><name>Ann</name></user>
output: {
  "user": {
    "@id": "1",
    "name": "Ann"
  }
}
```

The compact convention collapses based on how many times a child name appears: once becomes a single value, twice or more becomes an array. An element containing only text and no attributes collapses all the way down to a plain string. That is why `name` above became `"Ann"` directly rather than `{"#text": "Ann"}`.

```example
title: repeated child elements become an array
input: <note><to>Tove</to><to>Jani</to><body>Hi</body></note>
output: {
  "note": {
    "to": [
      "Tove",
      "Jani"
    ],
    "body": "Hi"
  }
}
```

Comments and processing instructions are dropped since they carry no data; CDATA sections are kept as their literal text, indistinguishable from ordinary character data once parsed:

```example
title: CDATA becomes plain text
input: <a><b><![CDATA[<raw> & stuff]]></b></a>
output: {
  "a": {
    "b": "<raw> & stuff"
  }
}
```

Set **output** to `string` to get JSON text instead of an object, indented as you choose:

```example
title: string output with a custom indent
params: {"output": "string", "indent": 4}
input: <a>1</a>
output: {
    "a": "1"
}
```

## Options

- **attribute prefix**: the prefix added to attribute keys. Defaults to `@`.
- **text key**: the object key used for text content that sits alongside attributes or child elements (in compact mode) or always (in verbose mode). Defaults to `#text`.
- **compact**: the collapsing convention described above. When off (verbose mode), every element always becomes an object, every child list is always an array even with one entry, and the text key is always present, even when empty. Verbose mode is unambiguous and easier to process programmatically; compact mode is terser to read.
- **indent (string output)**: spaces per nesting level when **output** is `string`, from 0 to 10.
- **output**: `json` (the default) returns a real JavaScript object for the next pipeline step to use directly; `string` returns the same data serialized as JSON text, indented per the setting above.

## Common uses

- Reading values out of an RSS/Atom feed, a SOAP response, or an Android/Java resource XML file.
- Feeding parsed XML into a step that expects JSON, such as [json schema validate](/util/json_schema_validate/) or [json to typescript](/util/json_to_typescript/).
- Comparing two XML documents structurally by converting both to JSON first.

## Tips and pitfalls

- Malformed XML (a mismatched closing tag, an unquoted attribute) raises a clear "invalid XML" error rather than returning partial data.
- Leading and trailing whitespace is trimmed from every element's text, not just indentation between tags (`<a>  hi  </a>` gives `"hi"`). In mixed content such as `<p>Hello <b>bold</b> world</p>`, the text pieces are joined into one `#text` value and their position relative to the child elements is lost.
- An empty element (`<b/>` or `<b></b>`) becomes an empty string.
- If you need the XML reformatted instead of converted, see [xml pretty](/util/xml_pretty/) and [xml minify](/util/xml_minify/).
- Empty input returns an empty object `{}`, not an error.
