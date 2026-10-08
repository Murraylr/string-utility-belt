---
title: Markdown to Text: Strip Markdown Formatting Online
description: Strip Markdown formatting down to plain text online. Removes headings, emphasis, links and lists, with options to keep link URLs and code blocks.
---
## What is stripping Markdown?

Sometimes you want the words a Markdown document contains without any of its syntax, for a search index, a notification preview, a word count, or a plain-text export. This tool removes Markdown's structural markers (heading `#`, blockquote `>`, list bullets), its inline formatting (`**bold**`, `_italic_`, backtick code spans) and its links and images, leaving readable prose behind. Unlike [strip html tags](/util/strip_html_tags/), it understands Markdown syntax specifically rather than HTML tags.

## How it works

Block-level markers are removed line by line: heading hashes, blockquote `>` markers, list bullets and numbering, and task-list checkboxes:

```example
title: headings, emphasis and links become plain text
input: # Title

Some **bold** and _italic_ text with a [link](https://example.com).
output: Title

Some bold and italic text with a link.
```

Inline emphasis and links are then processed a paragraph at a time rather than a line at a time, because CommonMark allows emphasis and links to span a soft line wrap inside a paragraph. Treating each line in isolation would leave an opening `*` with no matching closer:

```example
title: emphasis spanning a wrapped line is still recognized
input: a *soft
wrapped* b
output: a soft
wrapped b
```

Fenced code blocks (opened and closed by a line of three or more backticks or `~~~`) are handled specially: their contents are left completely untouched by inline formatting rules (nothing inside a code block is emphasis or a link), and are either kept or dropped as a whole block, based on **keep code block contents**:

````example
title: keep link urls and code block contents
params: {"keepLinkUrls": true, "keepCodeBlocks": true}
input: # Title

```js
const x = 1;
```

See [docs](https://example.com/docs).
output: Title

const x = 1;

See docs (https://example.com/docs).
````

An inline code span also protects its own contents: Markdown syntax typed inside backticks, like the `*b*` in a code span holding `a *b* c`, is never treated as emphasis, and the backticks themselves are removed. Text that already contains an underscore, such as `snake_case_name`, is also left alone: `_` only counts as emphasis at a word boundary, matching CommonMark's rule.

## Options

- **keep link urls**: off by default, which reduces `[text](url)` to just `text`. When on, the URL is appended in parentheses: `text (url)`. Applies to both inline links and images; reference-style links (`[text][ref]`) always reduce to their text.
- **keep code block contents**: on by default, which keeps the text inside fenced code blocks (without the fence markers). When off, fenced code blocks are removed entirely. Indented (four-space) code blocks are not recognized as code and are treated like ordinary text.

## Common uses

- Building a search index or notification preview from Markdown-authored content.
- Computing an accurate word or character count on prose without Markdown syntax skewing it.
- Producing a plain-text email body or SMS from a Markdown template.

## Tips and pitfalls

- Backslash-escaped characters (`\*not emphasis\*`) come through as the literal character, matching CommonMark's escape rules.
- GitHub-style tables are not converted: their rows, pipes and `|---|` separator line pass through unchanged.
- Link reference definitions (`[label]: https://example.com`) are removed from the output entirely, but the visible reference text elsewhere in the document (`[label][ref]`) is kept.
- This tool expects Markdown text; passing structured data from a previous step raises an error. To go from Markdown to HTML instead of plain text, see [markdown to html](/util/markdown_to_html/); to strip HTML tags instead of Markdown syntax, see [strip html tags](/util/strip_html_tags/).
