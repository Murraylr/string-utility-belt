---
title: Escape HTML Online: Encode &, <, >, " and '
description: Escape the five HTML-unsafe characters (&, <, >, ", ') to entities online, so text can be safely inserted into HTML markup.
---
## What does escaping HTML mean?

HTML uses a handful of characters as syntax: `<` and `>` open and close tags, `&` starts a character reference, and `"` and `'` delimit attribute values. If you drop user text straight into a page (a comment, a username, a search term echoed back in the results), any of those characters can break out of where you meant to put it. A comment of `<script>alert(1)</script>` does not display as text; the browser runs it as a script tag. Escaping replaces each unsafe character with its HTML entity equivalent, so the browser renders it as the literal character instead of treating it as markup.

This tool does exactly one thing: it walks the input and replaces `&`, `<`, `>`, `"` and `'` with `&amp;`, `&lt;`, `&gt;`, `&quot;` and `&#39;`. It takes no options and has no configurable scope. Every occurrence of those five characters is escaped, every time.

## How it works

The five characters and their replacements:

| character | entity |
| --- | --- |
| `&` | `&amp;` |
| `<` | `&lt;` |
| `>` | `&gt;` |
| `"` | `&quot;` |
| `'` | `&#39;` |

Everything else (letters, digits, punctuation, Unicode text, whitespace) passes through unchanged. The scan is a single pass, so a `&` in the input is escaped to `&amp;` and never re-escaped, and characters are replaced independently of each other regardless of order.

```example
title: special characters
input: Tom & Jerry <3> "quotes" 'single'
output: Tom &amp; Jerry &lt;3&gt; &quot;quotes&quot; &#39;single&#39;
```

Plain text with nothing to escape is returned exactly as given:

```example
title: text with no special characters
input: hello world
output: hello world
```

An empty input produces an empty output, and Unicode letters outside the five special characters are left as-is. This tool does not touch anything above ASCII:

```example
title: unicode text passes through untouched
input: café & <naïve>
output: café &amp; &lt;naïve&gt;
```

## Escape HTML vs HTML entity encode

This tool covers the fixed, minimal set of five characters. It is the same set PHP's `htmlspecialchars()` escapes with the `ENT_QUOTES` flag, though PHP by default writes the single quote as the numeric `&#039;` where this tool uses `&#39;` (the same character, just zero-padded). Most templating engines auto-escape a similar set by default. If you need more control (decimal or hex numeric references instead of named ones, or escaping every non-ASCII character as well), use [HTML entity encode](/util/html_entity_encode/) instead, which adds a `mode` (named/decimal/hex) and `scope` (minimal/non-ascii/all) option. To reverse this tool's output, use [unescape HTML](/util/unescape_html/), which also understands `&apos;` and the numeric equivalents this tool doesn't produce.

## Common uses

- Rendering user-submitted text (comments, form fields, search queries) inside HTML without letting it inject markup or scripts.
- Escaping text that will sit inside a quoted HTML attribute value, where a stray `"` would end the attribute early. (Unquoted attribute values are not made safe by this escaping. Always quote them.)
- Preparing plain text for inclusion in generated HTML reports, emails, or templates.
- Sanitizing text before logging it to an HTML-rendered log viewer, so a logged value can't inject markup that changes how the log entry displays.

## Tips and pitfalls

- This is not a full HTML sanitizer. It escapes five characters; it does not strip `<script>` tags, validate structure, or understand HTML at all. If you need to remove tags rather than escape them, use [strip HTML tags](/util/strip_html_tags/).
- Escaping protects you when inserting text as HTML *content*. Inserting it into a `<script>` block, a `style` attribute, or a URL needs different escaping rules that this tool does not apply. For a value placed inside a URL, use [URL encode](/util/url_encode/).
- If you specifically need JavaScript-string-safe output rather than HTML-safe output, use [code string escape](/util/code_string_escape/) instead. Escaping `<` and `>` does nothing to protect a string literal from a stray quote or backslash.
- Text that is already escaped gets escaped again: `&amp;` becomes `&amp;amp;`. Escape raw text exactly once.
- Because the encoding is a straightforward find-and-replace, it is fully reversible: escaping then [unescaping](/util/unescape_html/) always returns the original text.
