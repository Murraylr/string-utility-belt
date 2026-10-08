---
title: XML Unescape Online: Decode XML Entities to Text
description: Decode XML's five predefined entities and numeric character references (&#decimal; and &#xHEX;) back into plain text.
---
## What does unescaping XML mean?

XML documents write a small set of characters as entity or numeric references rather than as literal text, because those characters otherwise clash with XML's own syntax. This tool reverses that: it resolves XML's five predefined entities (`&lt;`, `&gt;`, `&amp;`, `&quot;`, `&apos;`) and any `&#decimal;` or `&#xHEX;` numeric reference back into the character it represents, so you can read the underlying text from an XML fragment, attribute value, or feed entry.

It is the counterpart to [XML escape](/util/xml_escape/) and follows XML 1.0's rules, including requiring the trailing `;` that XML (unlike some HTML parsers) never lets you skip.

## How it works

The decoder scans the input and, at each `&`, checks for a numeric reference or one of the five predefined names, replacing it with the character it stands for. Anything else, including HTML-only entities XML doesn't define, is left exactly as written.

```example
title: predefined entities
input: &lt;a&gt;Tom &amp; Jerry&lt;/a&gt;
output: <a>Tom & Jerry</a>
```

```example
title: numeric references
input: x&#65;&#x42;y
output: xABy
```

Numeric references are read as a raw Unicode code point. There is no windows-1252 remapping the way HTML numeric references sometimes get, since XML numeric references always mean exactly the code point they encode. A reference beyond the Basic Multilingual Plane still decodes to a single character:

```example
title: an astral code point decodes to one character
input: &#128512;
output: 😀
```

### What this tool will not decode

XML defines only five named entities. Anything else, including the wide named-entity table HTML supports (`&nbsp;`, `&copy;`, `&eacute;`, and so on), is left untouched because it has no meaning without a DTD declaring it:

```example
title: HTML-only named entities are not XML and are left alone
input: &nbsp;&copy;
output: &nbsp;&copy;
```

## Common uses

- Reading the underlying text out of XML element content or attribute values pulled from feeds, SOAP responses, or config files.
- Reversing output from [XML escape](/util/xml_escape/) to recover the original source text.
- Debugging XML that shows literal `&amp;` or `&lt;` where you expected the real character.
- Extracting plain text from XML-based formats (SVG, RSS, XHTML) for display or further processing.

## Tips and pitfalls

- A reference must end in `;` to be recognized at all. XML has no concept of the unterminated legacy names that some HTML parsers accept, so `&amp` (no semicolon) is left as literal text.
- A numeric reference to a code point XML 1.0 forbids throws an error rather than producing an invalid character. That covers most C0 controls, lone surrogates (U+D800–U+DFFF), and values above U+10FFFF. This matches how a strict XML parser would reject the same input.
- If your text uses HTML's broader named-entity set instead of just XML's five, use [HTML entity decode](/util/html_entity_decode/). It also resolves numeric references, plus about 280 named entities XML doesn't know about.
- To go the other direction, use [XML escape](/util/xml_escape/), which also has an option to escape non-ASCII characters as numeric references and to skip quote escaping.
