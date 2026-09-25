---
title: Text Diff Online — Compare Two Texts Line by Line
description: Diff two texts by line, word, or character and view the result as a unified diff, inline markup, side-by-side text, or JSON.
---
## What does this diff tool compare?

This tool compares your input against a second text (the **other text** parameter) and shows exactly what
changed between them — which lines, words, or characters were added, removed, or left alone. It's the same
kind of comparison a version control diff shows for a file, available for any two pieces of text without
needing a repository. The comparison itself is done by the open-source jsdiff library, which implements
Eugene Myers' O(ND) difference algorithm.

## How it works

By default the comparison works line by line and is rendered in the unified hunk format used by
`git diff` and `diff -u`: a `@@ … @@` header giving each changed region's line numbers, a space before
unchanged context lines, `-` before removed lines, and `+` before added lines. There are no `---`/`+++`
file-name headers, so the output is for reading rather than for applying with `patch`:

```example
title: a unified diff of one changed line
params: {"other": "line one\nline 2\nline three\n"}
input:
line one
line two
line three

output:
@@ -1,3 +1,3 @@
 line one
-line two
+line 2
 line three
```

Setting **granularity** to `words` or `characters` compares smaller pieces instead of whole lines, and
**format: inline** marks changes right in the flowing text with `{+added+}` and `[-removed-]` instead of
separate lines:

```example
title: a word-level inline diff
params: {"other": "the slow brown fox", "granularity": "words", "format": "inline"}
input: the quick brown fox
output: the [-quick-]{+slow+} brown fox
```

**format: side-by-side** lines the old and new versions up in two columns, with `|` marking a changed line
that exists on both sides, `<` for a line only on the left, and `>` for a line only on the right:

```example
title: side-by-side columns
params: {"other": "a\nc\n", "format": "side-by-side"}
input:
a
b

output: a   a
b | c
```

**format: json** returns the same comparison as structured data — a list of unchanged/added/removed
chunks, each with its text and a count, plus a summary and an `identical` flag:

```example
title: json output
params: {"other": "b\n", "format": "json"}
input:
a

output:
{
  "granularity": "lines",
  "identical": false,
  "stats": {
    "added": 1,
    "removed": 1,
    "unchanged": 0
  },
  "changes": [
    {
      "type": "remove",
      "value": "a\n",
      "count": 1
    },
    {
      "type": "add",
      "value": "b\n",
      "count": 1
    }
  ]
}
```

Two identical texts produce no output at all in the `unified` and `side-by-side` formats. The `inline`
format returns the text itself with no markers, and `json` reports `identical: true` with nothing added
or removed in `stats`.

## Options

- **other text** — the second text to compare the input against. Can be pasted or loaded from a file.
- **granularity** — `lines` (default), `words`, or `characters`.
- **format** — `unified` (default), `inline`, `side-by-side`, or `json`.
- **context lines** — how many unchanged lines to show around each change in the `unified` and
  `side-by-side` formats, default 3. Set it to 0 to see only the changed lines themselves; nearby changes
  within each other's context window are merged into one hunk.
- **ignore case** — off by default. Case differences are treated as no change.
- **ignore whitespace** — off by default. At `lines` granularity it ignores leading and trailing
  whitespace on each line (a change in spacing inside a line still counts); at `words` granularity it
  compares the words with the whitespace between them ignored; at `characters` granularity any whitespace
  character is treated as equal to any other whitespace character.

## Common uses

- Reviewing what changed between two drafts, versions of a config file, or API responses.
- Spotting a subtle change — a flipped word, an extra space, a changed value — that's easy to miss by eye
  in two long blocks of text.
- Generating a patch-style diff to paste into a code review comment or bug report.
- Feeding the `json` format into another tool or script that needs to know exactly what changed and where.

## Tips and pitfalls

- `granularity: words` in the default mode treats whitespace as significant, so a change in spacing alone
  shows up as a diff; turning on **ignore whitespace** switches to comparing words with their surrounding
  whitespace stripped, so only the words themselves are compared.
- The `characters` granularity has no built-in whitespace option of its own — **ignore whitespace** at that
  granularity works by treating any whitespace character as equal to any other, not by ignoring it outright.
- Character diffs work on Unicode code points, so a diff never splits an emoji or other astral character
  across the removed/added boundary, and side-by-side columns are padded by code point.
- A missing newline at the end of one text makes its last line differ from the other's, even though the
  `-` and `+` lines look identical — there is no "No newline at end of file" marker to explain it.
- When **ignore case** or **ignore whitespace** makes two pieces count as equal, the unchanged text shown
  is taken from the other text, not from your input.
- For finding which lines exist in one list but not another (rather than an edit-by-edit diff), see
  [line set operations](/util/set_operations/) instead — it's a better fit for unordered lists than a diff
  is.
- To measure how different two short strings are as a single number instead of viewing the changes, see
  [string distance](/util/string_distance/).
