---
title: XML Minifier Online — Remove Whitespace from XML
description: Minify XML online by stripping indentation whitespace and comments, while keeping the spaces inside text and CDATA sections intact.
---
## What is XML minification?

Hand-formatted or pretty-printed XML carries whitespace that exists purely for human readability — the newlines and indentation between tags. That whitespace adds size with no semantic value, so before transmitting or storing an XML document you often want it collapsed onto as few characters as possible, a job similar to `xmllint --noblanks`. Unlike a naive "remove all whitespace" approach, this tool only touches whitespace-only text and the line-break runs that wrap real text, so spaces within a line of text are kept.

## How it works

Whitespace-only text sitting between two tags — usually pure indentation — is removed entirely:

```example
title: strips indentation whitespace between tags
input: <root>
  <item>value</item>
</root>
output: <root><item>value</item></root>
```

Comments are removed by default, since they carry no data the reader of the minified document needs:

```example
title: removes comments by default
input: <a>
  <!-- note -->
  <b>1</b>
</a>
output: <a><b>1</b></a>
```

The tricky case is text that sits right next to real content. Indentation immediately inside an element's own tags is stripped, but a line break that separates two words — one before a sibling element, one after — is collapsed to a single space instead of being deleted outright, since deleting it would glue the words together:

```example
title: a line break next to a sibling element becomes one space, not nothing
input: <p>Hello
<b>x</b>
world</p>
output: <p>Hello <b>x</b> world</p>
```

Compare that to indentation that has no adjacent word to protect, which disappears completely:

```example
title: pure indentation around text disappears entirely
input: <desc>
    Some long text
  </desc>
output: <desc>Some long text</desc>
```

CDATA sections, processing instructions and the doctype declaration are always copied through byte for byte, since rewriting whitespace inside them would change their actual content.

## Options

- **remove comments** — when on (the default), `<!-- ... -->` comments are deleted along with their surrounding whitespace. When off, comments are kept exactly as written.

## Common uses

- Shrinking an XML payload before sending it over a slow connection or storing it in a size-limited field.
- Normalizing XML that mixes hand-edited and machine-generated formatting into one compact form before comparing or hashing it.
- Preparing test fixtures where exact whitespace should not matter to the assertion.

## Tips and pitfalls

- Running this tool twice in a row is idempotent — minifying already-minified XML changes nothing further.
- Every whitespace-only text node goes, even a meaningful one: `<b>a</b> <i>b</i>` becomes `<b>a</b><i>b</i>`, and `<a> </a>` becomes `<a></a>`. `xml:space="preserve"` is not honoured, so avoid it for XHTML-like mixed content or whitespace-sensitive data.
- Minifying does not validate the document beyond checking that tags are properly nested and closed; malformed XML raises a specific error naming the problem.
- To reverse this and make XML readable again, see [xml pretty](/util/xml_pretty/); to work with the data as JSON instead of markup, see [xml to json](/util/xml_to_json/).
