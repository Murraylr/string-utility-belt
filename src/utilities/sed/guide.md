---
title: Sed Script Online — Run sed-Style Text Edits
description: Run sed-style s, y, d and p commands online with line addresses and regex, using JavaScript regex syntax instead of POSIX.
---
## What is this sed tool?

`sed` (stream editor) is a classic Unix tool for scripted, line-based text editing: substitute a pattern, delete lines that match an address, translate characters, all from a short script instead of a GUI. This utility runs a small, sed-flavored script over your text in the browser. It supports four of the most-used commands — `s` (substitute), `y` (transliterate), `d` (delete) and `p` (print) — and a subset of sed addressing: `/regex/`, a line number, `$` for the last line, a numeric range such as `2,5` or `3,$`, and `!` to negate. The key difference from real `sed` is that patterns are **JavaScript regular expressions**, not POSIX basic or extended regular expressions — capture groups are written `(a)` rather than `\(a\)`, and character classes follow JavaScript syntax.

## How it works

Each line of the **script** option is one command, run in order against the input. By default (**apply per line** on) the script runs once per line of the input, the way real `sed` processes a stream; turning it off runs the whole input through the script as a single block of text instead.

### Substitution with `s`

`s/pattern/replacement/flags` finds `pattern` and replaces it with `replacement`. Add `g` to replace every match on the line instead of just the first:

```example
title: global substitute, one line at a time
params: {"script": "s/foo/QUX/g", "perLine": true}
input:
foo bar
baz foo
output:
QUX bar
baz QUX
```

Other flags are `i` (ignore case), `m` (multiline `^`/`$`), `s` (dot matches newline) and `p` (print the line again if a substitution was made). A digit before or after `g` targets a specific occurrence: `s/o/0/2` replaces only the 2nd match, and `s/o/0/2g` replaces the 2nd match onward.

```example
title: replace only the 2nd occurrence
params: {"script": "s/o/0/2"}
input: foo boo
output: fo0 boo
```

The replacement supports `&` for the whole match, `\1`–`\9` for capture groups, `\U` and `\L` to upper- or lower-case everything that follows, `\u` and `\l` for just the next character, and `\E` to stop case conversion:

```example
title: upper-case the first of two capture groups
params: {"script": "s/(\\w+) (\\w+)/\\U\\1\\E-\\2/"}
input: ab cd
output: AB-cd
```

### Deleting and printing lines with addresses

`d` deletes matching lines and `p` prints an extra copy of them; both accept an address before the command that restricts which lines they apply to. An address can be a `/regex/` (optionally followed by `I` for case-insensitive), a line number, `$` for the last line, or a numeric `from,to` range where `to` may be `$`; any of those can be followed by `!` to negate the match. Regex ranges like `/start/,/end/` and step addresses like `1~2` are not supported.

```example
title: delete lines matching a regex address
params: {"script": "/^#/d"}
input:
# comment
keep
# more
output: keep
```

### Transliterating characters with `y`

`y/from/to/` replaces each character in `from` with the character at the same position in `to`, like [translate characters](/util/tr/) but inside a larger script. Unlike that tool, `y` has no `a-z` ranges or `[:class:]` names, and both sets must be the same length or the script is rejected:

```example
title: transliterate a set of characters
params: {"script": "y/abc/xyz/"}
input: aabbcc
output: xxyyzz
```

### Whole-text mode

With **apply per line** off, the entire input is treated as a single block: `^` and `$` in a pattern match the very start and end of the whole text rather than each line, and a `d` on any matching address discards everything.

```example
title: with "apply per line" off, ^ anchors the whole text once
params: {"script": "s/^a/X/", "perLine": false}
input:
a
a
output:
X
a
```

## Options

- **script** — one command per line: `s/pattern/replacement/flags`, `y/from/to/`, `d`, or `p`, each optionally preceded by an address and `!`. Lines starting with `#` are comments and blank lines are ignored. Defaults to `s/foo/bar/g`.
- **apply per line** — when on (the default), the script runs once per line of the input, with line-number and `$` addresses referring to that line's position. When off, the whole input is one pattern space.

## Common uses

- Batch substitutions across many lines in one script, instead of one-at-a-time with [find and replace](/util/replace/).
- Dropping comment or blank lines from a config file or log with a `/pattern/d` address.
- Extracting or reordering the parts of each line using capture groups, such as swapping two fields separated by a space.
- Applying a small chain of edits — a substitute, then a delete — that would otherwise need several separate pipeline steps.

## Tips and pitfalls

- Because patterns are JavaScript regular expressions, write capture groups as `(a)` rather than the POSIX basic-regex `\(a\)` — here `\(` matches a literal parenthesis, so the pattern has no groups and a `\1` reference to it throws an error rather than silently expanding to nothing.
- There is no `-n` switch: every line is printed automatically, so `p` always adds a duplicate. To print only matching lines, use `/pattern/!d` or [grep lines](/util/grep_lines/).
- Only one command per script line. Joining commands with `;` (`s/a/b/;s/c/d/`), `{ }` blocks and other sed commands such as `a`, `i`, `c`, `q` or `n` are not supported.
- A capture-group reference beyond what the pattern actually has, such as `\2` when the pattern has only one group, is rejected up front rather than producing an empty string at run time.
- The `s///g` empty-match behavior follows real `sed`, not JavaScript's `replaceAll`: a pattern that can match zero-width (like `a*`) does not produce an empty match at the spot where the previous match ended, so `s/a*/-/g` turns `baa` into `-b-`.
- Delimiters other than `/` are supported (`s|/usr/bin|/opt|`), which is handy when the pattern itself contains `/`; alternatively escape it as `\/`.
- For a single find-and-replace without the sed script syntax, use [find and replace](/util/replace/); for filtering lines by a pattern without rewriting them, use [grep lines](/util/grep_lines/).
