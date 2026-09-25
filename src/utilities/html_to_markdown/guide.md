---
title: HTML to Markdown Converter Online — Convert HTML to MD
description: Convert HTML to Markdown online with atx or setext headings, a custom bullet marker, and fenced or indented code blocks, using Turndown.
---
## What is HTML to Markdown conversion?

Markdown is easier to write, diff and store in version control than HTML, so it is common to want to turn scraped or exported HTML — a blog post, a wiki page, an email body — into Markdown source. This tool wraps Turndown, a well-established HTML-to-Markdown converter, and exposes its main formatting choices as options. [markdown to html](/util/markdown_to_html/) does the reverse conversion.

## How it works

Common HTML elements map onto their Markdown equivalents: headings become `#` lines, `<strong>` becomes `**bold**`, `<em>` becomes `_italic_`, and `<a href>` becomes `[text](url)`:

```example
title: heading, bold, link
input: <h1>Title</h1><p>Some <strong>bold</strong> and <a href="https://example.com">a link</a>.</p>
output: # Title

Some **bold** and [a link](https://example.com).
```

Lists become bullet or numbered Markdown lists, with the bullet character controlled by the **bullet marker** option:

```example
title: custom bullet marker
input: <ul><li>one</li><li>two</li></ul>
params: {"bulletMarker": "*"}
output: *   one
*   two
```

Headings can be rendered as `#`-prefixed atx headings (the default) or as setext headings, where the heading text is followed by a line of `=` or `-` characters:

```example
title: setext heading style
input: <h1>Hello</h1><h2>Sub</h2>
params: {"headingStyle": "setext"}
output: Hello
=====

Sub
---
```

`<pre><code>` blocks can be rendered as fenced code blocks (surrounded by triple backticks, the default) or as classic four-space indented blocks:

```example
title: indented code block style
input: <pre><code>x=1
y=2</code></pre>
params: {"codeBlockStyle": "indented"}
output:     x=1
    y=2
```

`<script>`, `<style>` and `<noscript>` elements are dropped along with their contents, rather than spilling raw JavaScript or CSS into the converted text.

## Options

- **heading style** — `atx` (`# Heading`, the default) or `setext` (an underline of `=` for level 1 and `-` for level 2; Setext has no form for deeper levels, so `<h3>` to `<h6>` still come out as `###`-style atx headings).
- **bullet marker** — `-`, `*` or `+` for unordered list items. Defaults to `-`.
- **code block style** — `fenced` (triple backtick fences, the default; a `language-js` class on the `<code>` element becomes a `js` language hint after the opening fence) or `indented` (four leading spaces, with no language annotation possible).

## Common uses

- Archiving a scraped web page or exported CMS article as Markdown for a static site generator.
- Converting a rich-text email or wiki export into Markdown for a README or changelog.
- Feeding cleaned-up prose into a Markdown renderer or a documentation pipeline.

## Tips and pitfalls

- This tool expects HTML text; passing structured data from a previous pipeline step (rather than a string) raises an error instead of silently stringifying it.
- Empty or whitespace-only input produces empty output.
- Only core Markdown is produced. Tables, strikethrough and task lists have no rule here, so a `<table>` comes out as its cell text in separate paragraphs and `<del>` loses its markup.
- If you only need plain text with all formatting removed rather than Markdown, use [strip html tags](/util/strip_html_tags/) directly, or convert to Markdown first and then run [strip markdown](/util/markdown_strip/).
