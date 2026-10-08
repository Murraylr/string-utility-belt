---
title: Strip HTML Tags Online: Convert HTML to Plain Text
description: Remove HTML tags online to get plain text. Decodes entities, keeps paragraph and list line breaks, and lets you allow specific tags through.
---
## What is stripping HTML tags?

Extracting the readable text from an HTML document (for a search index, a plain-text email fallback, a word count, or a preview snippet) means removing every tag while keeping the words, and deciding what happens to structural elements like paragraphs and list items along the way. This tool strips tags directly using pattern matching, without a DOM parser, and decodes HTML character references back to real characters.

## How it works

Tags are removed, and by default a block-level element like `<p>`, `<div>` or `<h1>` starts a new line, so paragraphs stay visually separated instead of running together:

```example
title: paragraphs become separated lines
input: <p>Hello <b>World</b></p><p>Bye</p>
output: Hello World

Bye
```

List items, table rows and similar "line" elements get a single line break rather than a full blank line between them, so a list reads as one item per line instead of one paragraph per item:

```example
title: list items become line-separated, table cells space-separated
input: <ul><li>one</li><li>two</li></ul><table><tr><td>1</td><td>2</td></tr></table>
output: one
two

1 2
```

`<script>` and `<style>` contents are dropped along with their tags, since that is code and CSS, not readable text. Comments and the doctype declaration are removed the same way:

```example
title: script, style and comment contents are dropped, not just their tags
input: <!DOCTYPE html><!-- secret --><style>p{color:red}</style><div>text</div><script>var a = 1;</script>
output: text
```

HTML character references decode back to real text by default: named references like `&amp;` (the classic HTML 4 set of about 250 names; newer HTML5-only names such as `&check;` are left as written), decimal and hexadecimal numeric references, and even astral characters like emoji written as `&#128512;`:

```example
title: entities decode, including astral numeric references
input: Caf&eacute; &amp; co &mdash; &#128512;
output: Café & co — 😀
```

You can also let specific tags through untouched instead of stripping everything, useful when you want to keep basic inline formatting like bold or links:

```example
title: allow specific tags through
input: <p>Hello <b>world</b></p>
params: {"allowedTags": "b"}
output: Hello <b>world</b>
```

## Options

- **decode entities**: on by default, decodes HTML character references (`&amp;`, `&#233;`, `&#x1F600;`) to their actual characters. When off, entities are left as literal text.
- **keep block line breaks**: on by default: block-level elements (paragraphs, headings, list items, table rows, and more) introduce line breaks so the text keeps some visual structure, while inline tags such as `<b>` vanish without a trace. When off, everything is collapsed onto a single line and every tag, inline ones included, becomes a space, so `Hel<b>lo</b>` gives `Hel lo`.
- **allowed tags**: a comma or space separated list of tag names (such as `b, i, a`) to keep in the output exactly as written, instead of stripping them. Kept tags keep all their attributes, `onclick` handlers and `javascript:` URLs included, so this is not a safe allow-list for untrusted HTML. Empty by default, meaning every tag is stripped.

## Common uses

- Generating a plain-text fallback for an HTML email.
- Building a search index or preview snippet from rendered HTML content.
- Reducing pasted rich text to plain text before storing it.

## Tips and pitfalls

- Numeric character references in the 0x80–0x9F range are interpreted as Windows-1252 characters, matching how real browsers and HTML parsers treat them (`&#151;` is an em dash, not a control character). An unusable numeric reference (a lone surrogate, or out of Unicode's range) decodes to the replacement character `�` instead of breaking the output.
- Content decoded from entities is never re-interpreted as new tags: `&lt;b&gt;` always stays as the text `<b>`, even with **decode entities** on.
- This is not an HTML sanitizer. The output is plain text, and with **decode entities** on, `&lt;script&gt;` in the input becomes a literal `<script>` in the output. Escape the result (for example with [escape html](/util/escape_html/)) before inserting it into a web page, and use a real sanitizer when you need to keep some untrusted markup.
- This tool expects HTML text; passing structured data from a previous step raises an error. To convert HTML to Markdown instead of plain text, see [html to markdown](/util/html_to_markdown/); to strip Markdown syntax instead of HTML tags, see [strip markdown](/util/markdown_strip/).
