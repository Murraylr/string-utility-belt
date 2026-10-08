---
title: Unescape HTML Online: Decode HTML Entities to Text
description: Decode &amp;, &lt;, &gt;, &quot; and &#39; (and a few common aliases) back into plain text characters online.
---
## What does unescaping HTML mean?

When text is stored or transmitted as HTML, the characters that have special meaning in markup (`&`, `<`, `>`, `"` and `'`) are usually written as entities instead of literal characters, so they don't get mistaken for tags or attribute delimiters. Unescaping reverses that: it looks for those entities and turns them back into the plain characters they represent. This is the everyday counterpart to [escape HTML](/util/escape_html/): copy HTML source out of a page, an API response, or an RSS feed, run it through this tool, and get back readable text.

## How it works

The tool recognizes a fixed set of entities and replaces each one with its character:

| entity | character |
| --- | --- |
| `&amp;` | `&` |
| `&lt;` | `<` |
| `&gt;` | `>` |
| `&quot;` | `"` |
| `&#39;` | `'` |
| `&apos;` | `'` |
| `&#x27;` | `'` |
| `&#x2F;` | `/` |

Everything else in the input (plain text, unrecognized entities, stray ampersands) is left exactly as it was.

```example
title: basic entities
input: Tom &amp; Jerry &lt;3&gt;
output: Tom & Jerry <3>
```

```example
title: quotes
input: It&#39;s &quot;fine&quot;
output: It's "fine"
```

Text with no entities at all round-trips unchanged, and this tool makes only one pass over the input. The result of a replacement is never scanned again for further entities:

```example
title: text with no entities
input: hello & &unknown; world
output: hello & &unknown; world
```

## Which entities this tool covers

This decoder handles the small set above: the five characters `escape HTML` escapes, plus the `&apos;`, `&#x27;` and `&#x2F;` variants some tools and older code emit for `'` and `/`. It is intentionally narrow. It will not resolve named entities like `&copy;` or `&eacute;`, and it will not decode arbitrary `&#NNN;` or `&#xHH;` numeric references beyond the ones listed. Matching is exact and case-sensitive, so variants such as `&#039;` (zero-padded) or `&#x2f;` (lowercase hex) are left as they are too. If your text contains those, use [HTML entity decode](/util/html_entity_decode/) instead, which resolves about 280 common named entities (the HTML 4.01 set plus some HTML5 names) and any decimal or hex numeric reference.

## Common uses

- Turning HTML-escaped text copied from a page's source, an API response, or a feed back into plain, readable text.
- Reversing output produced by [escape HTML](/util/escape_html/). (PHP's `htmlspecialchars()` writes `'` as `&#039;` by default, which this tool does not decode; use [HTML entity decode](/util/html_entity_decode/) for that.)
- Cleaning up text extracted from HTML that was stored pre-escaped in a database or CSV export.
- Preparing HTML-escaped log lines or comments for display somewhere that doesn't render HTML.

## Tips and pitfalls

- This tool is not a security control. It only converts entities to characters. If the resulting text is later inserted into HTML again without re-escaping, any `<` or `&` it contains can act as markup once more.
- Because the scan happens in a single pass, a string like `&amp;lt;` decodes to `&lt;` (only the `&amp;` is resolved), not all the way to `<`. Run the tool again if you deliberately need to unwind a double-escaped string.
- For the reverse direction, use [escape HTML](/util/escape_html/); for the wider entity set (named, decimal, and hex references), use [HTML entity decode](/util/html_entity_decode/) and its counterpart [HTML entity encode](/util/html_entity_encode/).
- If your source text uses XML's predefined entities instead of HTML's, [XML unescape](/util/xml_unescape/) covers the same five characters plus proper `&#decimal;` / `&#xHEX;` numeric references under XML's stricter rules.
