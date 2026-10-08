---
title: Find and Replace Text Online: Regex Replacer
description: Find and replace text online using a literal string or a regular expression, with capture groups and flags, right in your browser.
---
## What is find and replace?

Find and replace scans text for every place a pattern occurs and swaps it for something else. This tool offers two ways to describe that pattern: a plain literal substring, or a JavaScript regular expression with character classes, capture groups and flags. It is the same idea as a text editor's "Find & Replace" dialog, or the `s///` command in [sed script](/util/sed/), but it runs once over the whole input rather than as part of a multi-command script.

## How it works

Four options control the substitution: **pattern**, **replacement**, **use regex**, and **flags**.

With **use regex** off, the pattern is treated as a literal string. Every occurrence is replaced: the tool splits the input on the pattern and rejoins it with the replacement, which is equivalent to a global, case-sensitive substring replace. Regex metacharacters like `.` or `*` in the pattern have no special meaning in this mode.

```example
title: literal replace, every occurrence
params: {"pattern": "foo", "replacement": "baz", "regex": false, "flags": "g"}
input: foo bar foo
output: baz bar baz
```

With **use regex** on (the default), the pattern is compiled as a JavaScript `RegExp` and the replacement supports JavaScript's `String.prototype.replace` substitution syntax: `$1`, `$2`, … insert capture groups, `$<name>` inserts a named group, `$&` inserts the whole match and `$$` inserts a literal dollar sign. This is different from sed, which uses backslash group references like `\1`.

```example
title: regex with a capture group
params: {"pattern": "foo(\\d)", "replacement": "F$1", "regex": true, "flags": "g"}
input: foo1 foo2
output: F1 F2
```

The **flags** field is only used in regex mode. It defaults to `g` (replace every match). Any flag string that includes `g` replaces every match; a flag string without `g` (including a field you explicitly cleared, or just `i`) replaces only the first match. Add `i` for case-insensitive matching:

```example
title: case-insensitive regex replace
params: {"pattern": "hello", "replacement": "hi", "regex": true, "flags": "gi"}
input: Hello hello
output: hi hi
```

An empty **replacement** deletes every match instead of substituting text for it:

```example
title: delete matches with an empty replacement
params: {"pattern": "\\d+", "replacement": "", "regex": true, "flags": "g"}
input: abc123def
output: abcdef
```

If **pattern** is left blank, the input passes through completely unchanged in either mode. There is no error, and nothing is replaced.

```example
title: an empty pattern is a no-op
params: {"pattern": "", "replacement": "X", "regex": true, "flags": "g"}
input: hello
output: hello
```

## Options

- **pattern**: the text (literal mode) or regular expression (regex mode) to search for. Blank means "match nothing."
- **replacement**: the text that replaces each match. In regex mode it can reference capture groups with `$1`, `$2`, and so on, or the whole match with `$&`. In literal mode it is inserted exactly as typed, so `$1` stays `$1`. Leaving it blank deletes matches.
- **use regex**: toggles between a literal substring replace and a JavaScript regular expression. Default on.
- **flags**: regex flags such as `g` (global), `i` (case-insensitive), `m` (multiline `^`/`$`), or `s` (dot matches newline). Only applies in regex mode; defaults to `g`.

## Common uses

- Cleaning up scraped or copy-pasted text: collapsing repeated punctuation, stripping stray markers, normalizing dashes or quotes.
- Renaming identifiers or keys across a block of text using a capture group to keep part of the match.
- Redacting sensitive substrings by replacing a matched pattern with a placeholder.
- Standardizing delimiters or line prefixes before feeding text into another step, such as [split & join](/util/split_join/) or [csv delimiter](/util/csv_delimiter/).

## Tips and pitfalls

- In literal mode, characters that are special in regular expressions (`.`, `*`, `(`, `[`, and so on) are matched exactly, with no escaping needed. Switch to regex mode only when you actually need pattern matching.
- Turning off regex mode also turns off the flags field's effect entirely: there is no way to do a case-insensitive literal replace without switching to regex mode and adding the `i` flag.
- An invalid regular expression (unbalanced parentheses, a dangling `*`, and so on) throws an error and stops the step rather than silently doing nothing.
- For a full script of multiple substitutions, deletions and line addresses in one pass, use [sed script](/util/sed/); for translating individual characters rather than substrings, use [translate characters](/util/tr/).
- To replace only on certain lines while keeping the rest, put an address in front of an `s` command in [sed script](/util/sed/), such as `/^b/s/x/y/`. [grep lines](/util/grep_lines/) can isolate matching lines first, but it drops every other line.
