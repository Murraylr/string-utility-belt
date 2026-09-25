---
title: Markdown to HTML Converter Online — Render Markdown
description: Convert Markdown to HTML online with GitHub-flavored syntax, optional hard line breaks, and slug ids on headings, powered by the marked parser.
---
## What is Markdown to HTML conversion?

Markdown is written as plain text but needs to become HTML before a browser can render it — that is what every static site generator, README viewer and comment system does behind the scenes. This tool wraps `marked`, a widely used Markdown parser, so you can see exactly what HTML a piece of Markdown produces. [html to markdown](/util/html_to_markdown/) converts back the other way.

## How it works

Headings, emphasis, links and other standard Markdown syntax render as their HTML equivalents:

```example
title: heading, bold and a link
input: # Title

Some **bold** text and a [link](https://example.com).
output:
<h1>Title</h1>
<p>Some <strong>bold</strong> text and a <a href="https://example.com">link</a>.</p>

```

With **github flavored markdown** on (the default), GitHub-specific extensions are also recognized: tables, `~~strikethrough~~`, task-list checkboxes (`- [ ]`), and automatic linking of bare URLs. Turning it off falls back to marked's standard, non-GFM rules, where a table renders as a paragraph of pipe characters instead of `<table>`.

By default, a single newline inside a paragraph is a soft wrap: it stays a plain newline in the HTML, which a browser displays as a space. Turning on **newlines become &lt;br&gt;** makes every line break inside a paragraph an explicit `<br>`, which is how GitHub renders issue and pull-request comments:

```example
title: hard line breaks
params: {"breaks": true}
input: a
b
output:
<p>a<br>b</p>

```

Turning on **add ids to headings** gives every heading an `id` attribute derived from its own text — lowercased, punctuation other than `-` and `_` stripped, spaces turned into hyphens — much like the slugs GitHub uses for its in-page heading links. One difference: a run of several spaces becomes a single hyphen here, where GitHub writes one hyphen per space. A repeated heading text gets a numeric suffix (`a`, `a-1`, `a-2`) so ids stay unique:

```example
title: heading ids, github-style slugs
params: {"headerIds": true}
input: ## Sub

Hello
output:
<h2 id="sub">Sub</h2>
<p>Hello</p>

```

## Options

- **github flavored markdown** — enables GFM extensions (tables, strikethrough, autolinked URLs). On by default.
- **newlines become &lt;br&gt;** — treats every single line break inside a paragraph as a hard break (`<br>`) instead of leaving it as a soft newline. Off by default.
- **add ids to headings** — adds a GitHub-style slug `id` to every heading, de-duplicated when the same heading text repeats. Off by default.

## Common uses

- Previewing how a README, changelog or comment will render before publishing it.
- Building a lightweight Markdown preview or documentation page without a full static site generator.
- Generating heading ids ahead of time for in-page anchor links.

## Tips and pitfalls

- This tool expects Markdown text; passing structured data from a previous pipeline step raises an error rather than silently stringifying it.
- Empty input produces empty output.
- Rendered HTML is not sanitized against XSS — raw HTML embedded in the Markdown source (such as `<img onerror=…>`) passes through unchanged, and so do `javascript:` link URLs. Treat the output as untrusted if the Markdown came from an untrusted source, and run it through a real HTML sanitizer before putting it on a page. If you need plain text instead of HTML, [strip markdown](/util/markdown_strip/) skips the HTML step entirely.
